import hashlib
import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.services.inference_service import run_detect_async
from app.services.clustering_service import assign_cluster
from app.services.geo_service import extract_gps_strict, wgs84_to_gcj02, extract_capture_time
from app.db.database import get_db
from app.db.models import DiseaseRecord, DiseaseCluster, User
from app.api.deps import get_optional_user
from app.core.time import utc_now

router = APIRouter(prefix="/api/v1", tags=["detect"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_FILES = 20
VALID_SOURCE_TYPES = {"dashcam", "mobile", "camera", "drone", "manual", "bus_dashcam", "street_camera", "citizen"}

_FALLBACK_LAT = 30.474
_FALLBACK_LNG = 114.414
_SPREAD       = 0.045


@router.post("/detect")
async def detect(
    files: list[UploadFile] = File(...),
    conf: float = Query(0.15, ge=0.0, le=1.0, description="置信度阈值"),
    lat: Optional[float] = Form(None, description="纬度（手动指定或浏览器定位，优先级最高）"),
    lng: Optional[float] = Form(None, description="经度（手动指定或浏览器定位，优先级最高）"),
    captured_at: Optional[str] = Form(None, description="手动指定拍摄时间；仅在图片无 EXIF 拍摄时间时使用"),
    source_type: Optional[str] = Form(None, description="数据来源：dashcam/mobile/camera/drone"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    接收 1–20 张图片，返回每张的检测结果与标注图。

    GPS 优先级：表单 lat/lng > 图片 EXIF > 批次内首张真实坐标 > 批次级随机演示坐标
    同批次同类型病害也必须通过空间/视觉聚类判定；无检测的图片作补充视角证据入库。
    同一图片内同类型的多个检测框只保留置信度最高的一个（避免全景重复展示同图）。
    """
    if len(files) > MAX_FILES:
        raise HTTPException(400, detail=f"单次最多上传 {MAX_FILES} 张图片")

    effective_source = (
        source_type if source_type in VALID_SOURCE_TYPES
        else (current_user.source_type or "manual") if current_user else "citizen"
    )

    # ── 批次级 GPS 状态 ─────────────────────────────────────────────────────
    # 浏览器定位 / 手动传入坐标均为 WGS-84，转换为高德使用的 GCJ-02
    if lat is not None and lng is not None:
        user_lat, user_lng = wgs84_to_gcj02(lat, lng)
    else:
        user_lat, user_lng = None, None
    manual_captured_at: Optional[datetime] = None
    if captured_at:
        raw_capture_time = captured_at.strip()
        try:
            manual_captured_at = datetime.fromisoformat(raw_capture_time.replace("Z", "+00:00"))
            if manual_captured_at.tzinfo is not None:
                manual_captured_at = manual_captured_at.astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            raise HTTPException(422, detail="captured_at 格式无效，请使用 YYYY-MM-DDTHH:mm 或 ISO 时间格式")
    batch_real_lat: Optional[float] = None   # 批次内首张带 EXIF 的坐标
    batch_real_lng: Optional[float] = None
    # 若整批都无真实 GPS：生成一个批次级随机坐标（同批图片落在同一位置）
    batch_fake_lat = round(_FALLBACK_LAT + random.uniform(-_SPREAD, _SPREAD), 6)
    batch_fake_lng = round(_FALLBACK_LNG + random.uniform(-_SPREAD, _SPREAD), 6)

    # ── 批次级聚类状态 ──────────────────────────────────────────────────────
    batch_clusters: dict[str, str] = {}   # {label_cn: cluster_id}

    results = []

    for upload in files:
        if upload.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                415,
                detail=f"{upload.filename}: 不支持的文件类型，仅接受 JPG/PNG/WEBP/BMP",
            )

        img_bytes = await upload.read()
        img_hash    = hashlib.sha256(img_bytes).hexdigest()
        # EXIF 拍摄时间优先；图片无 EXIF 时才使用前端手动指定的批次拍摄时间。
        image_captured_at = extract_capture_time(img_bytes) or manual_captured_at

        # ── GPS 解析 ────────────────────────────────────────────────────────
        if user_lat is not None and user_lng is not None:
            rec_lat, rec_lng, gps_real = user_lat, user_lng, True
        else:
            exif_lat, exif_lng = extract_gps_strict(img_bytes)
            if exif_lat is not None:
                rec_lat, rec_lng, gps_real = exif_lat, exif_lng, True
                if batch_real_lat is None:
                    batch_real_lat, batch_real_lng = exif_lat, exif_lng
            elif batch_real_lat is not None:
                rec_lat, rec_lng, gps_real = batch_real_lat, batch_real_lng, True
            else:
                rec_lat, rec_lng, gps_real = batch_fake_lat, batch_fake_lng, False

        # ── 推理 ────────────────────────────────────────────────────────────
        try:
            res = await run_detect_async(img_bytes, conf=conf)
        except FileNotFoundError:
            raise HTTPException(503, detail="模型权重尚未就绪（best.pt 不存在），请等待训练完成后再试")
        except ValueError as e:
            raise HTTPException(422, detail=str(e))

        img_b64 = res.get("image_b64", "") or ""
        detections_raw = res.get("detections", [])

        # ── 同图去重：每种 label_cn 只保留置信度最高的一个检测框 ──────────
        best_by_label: dict[str, dict] = {}
        for det in detections_raw:
            lc = det.get("label_cn") or "__unknown__"
            if lc not in best_by_label or (det.get("conf") or 0) > (best_by_label[lc].get("conf") or 0):
                best_by_label[lc] = det
        deduped = list(best_by_label.values())

        augmented_detections = []

        # ── 有检测结果 ──────────────────────────────────────────────────────
        if deduped:
            for det in deduped:
                label_cn = det.get("label_cn")
                feature  = det.get("feature")

                # 去重：同一图片（相同 hash）同一病害类型已存在则跳过
                existing = db.query(DiseaseRecord).filter(
                    DiseaseRecord.content_hash == img_hash,
                    DiseaseRecord.label_cn == label_cn,
                    DiseaseRecord.deleted_at.is_(None),
                ).first()
                if existing:
                    cluster = db.query(DiseaseCluster).filter(
                        DiseaseCluster.cluster_id == existing.cluster_id
                    ).first()
                    augmented_detections.append({
                        "label":         existing.label,
                        "label_cn":      label_cn,
                        "conf":          existing.confidence,
                        "color":         existing.color_hex,
                        "bbox":          existing.bbox,
                        "record_id":     existing.id,
                        "cluster_id":    existing.cluster_id,
                        "cluster_count": cluster.detection_count if cluster else 1,
                        "gps_real":      gps_real,
                        "duplicate":     True,
                    })
                    if label_cn not in batch_clusters and existing.cluster_id:
                        batch_clusters[label_cn] = existing.cluster_id
                    continue

                cluster_id = assign_cluster(
                    rec_lat, rec_lng, label_cn, feature, db,
                    confidence=det.get("conf"),
                    bbox=det.get("bbox"),
                    location_is_real=gps_real,
                )
                batch_clusters.setdefault(label_cn, cluster_id)

                db_record = DiseaseRecord(
                    filename=upload.filename,
                    lat=rec_lat,
                    lng=rec_lng,
                    label=det.get("label"),
                    label_cn=label_cn,
                    confidence=det.get("conf"),
                    color_hex=det.get("color"),
                    bbox=det.get("bbox"),
                    feature_vector=feature,
                    cluster_id=cluster_id,
                    source_type=effective_source,
                    device_id=current_user.device_id if current_user else None,
                    creator_id=current_user.id if current_user else None,
                    thumbnail_b64=img_b64 or None,
                    content_hash=img_hash,
                    captured_at=image_captured_at,
                )
                db.add(db_record)
                db.flush()

                cluster = db.query(DiseaseCluster).filter(
                    DiseaseCluster.cluster_id == cluster_id
                ).first()
                augmented_detections.append({
                    "label":         det.get("label"),
                    "label_cn":      label_cn,
                    "conf":          det.get("conf"),
                    "color":         det.get("color"),
                    "bbox":          det.get("bbox"),
                    "record_id":     db_record.id,
                    "cluster_id":    cluster_id,
                    "cluster_count": cluster.detection_count if cluster else 1,
                    "gps_real":      gps_real,
                })

        # ── 无检测：补充视角证据（同一图片不重复入库）─────────────────────
        elif batch_clusters:
            ref_cid = next(iter(batch_clusters.values()))
            already = db.query(DiseaseRecord).filter(
                DiseaseRecord.content_hash == img_hash,
                DiseaseRecord.label_cn.is_(None),
                DiseaseRecord.deleted_at.is_(None),
            ).first()
            if not already:
                db_record = DiseaseRecord(
                    filename=upload.filename,
                    lat=rec_lat,
                    lng=rec_lng,
                    label=None, label_cn=None, confidence=None,
                    color_hex=None, bbox=None, feature_vector=None,
                    cluster_id=ref_cid,
                    source_type=effective_source,
                    device_id=current_user.device_id if current_user else None,
                    creator_id=current_user.id if current_user else None,
                    thumbnail_b64=img_b64 or None,
                    content_hash=img_hash,
                    captured_at=image_captured_at,
                )
                db.add(db_record)
                cluster = db.query(DiseaseCluster).filter(
                    DiseaseCluster.cluster_id == ref_cid
                ).first()
                if cluster:
                    cluster.detection_count += 1
                    cluster.last_detected_at = utc_now()
                db.flush()

        db.commit()

        results.append({
            "filename":     upload.filename,
            "detections":   augmented_detections,
            "image_b64":    res.get("image_b64", ""),
            "inference_ms": res.get("inference_ms", 0),
            "location":     {"lat": rec_lat, "lng": rec_lng, "gps_real": gps_real},
            "timestamp":    res.get("timestamp"),
        })

    return JSONResponse(content=results)


@router.post("/check-exif")
async def check_exif(file: UploadFile = File(...)):
    """调试接口：查看图片原始 EXIF GPS 信息，帮助诊断位置读取问题。"""
    from PIL import Image
    from PIL.ExifTags import GPSTAGS, TAGS
    import io as _io

    img_bytes = await file.read()
    try:
        image = Image.open(_io.BytesIO(img_bytes))
        exif = image.getexif()
        if not exif:
            return {"has_exif": False, "has_gps": False, "reason": "图片无 EXIF 数据"}

        gps_ifd = exif.get_ifd(0x8825)
        raw_gps = {GPSTAGS.get(k, k): str(v) for k, v in gps_ifd.items()} if gps_ifd else {}

        exif_lat, exif_lng = extract_gps_strict(img_bytes)
        capture_time = extract_capture_time(img_bytes)
        return {
            "has_exif": True,
            "has_gps": exif_lat is not None,
            "has_capture_time": capture_time is not None,
            "capture_time": capture_time.isoformat() if capture_time else None,
            "raw_gps_tags": raw_gps,
            "parsed_wgs84": None if exif_lat is None else {"lat": exif_lat, "lng": exif_lng},
            "reason": "成功读取 GPS" if exif_lat is not None else "EXIF 存在但无 GPSLatitude/GPSLongitude，请在手机相机设置中开启位置标记",
        }
    except Exception as e:
        return {"has_exif": False, "has_gps": False, "has_capture_time": False, "capture_time": None, "reason": str(e)}
