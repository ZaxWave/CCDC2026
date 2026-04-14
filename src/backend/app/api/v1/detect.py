from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse

from app.services.inference_service import run_detect

router = APIRouter(prefix="/api/v1", tags=["detect"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_FILES = 20


@router.post("/detect")
async def detect(
    files: list[UploadFile] = File(...),conf: float = Query(0.25, ge=0.0, le=1.0, description="置信度阈值") 
):
    """
    接收 1–20 张图片，返回每张的检测结果与标注图。

    Response body (JSON array):
    [
      {
        "filename":     "road.jpg",
        "detections":   [{"label","label_cn","tag","conf","bbox":[x1,y1,x2,y2]}, ...],
        "image_b64":    "data:image/jpeg;base64,...",
        "inference_ms": 42.5
      },
      ...
    ]
    """
    if len(files) > MAX_FILES:
        raise HTTPException(400, detail=f"单次最多上传 {MAX_FILES} 张图片")

    results = []
    for upload in files:
        if upload.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                415,
                detail=f"{upload.filename}: 不支持的文件类型 {upload.content_type}，仅接受 JPG/PNG/WEBP/BMP",
            )
        img_bytes = await upload.read()
        try:
            res = run_detect(img_bytes, conf=conf)
        except FileNotFoundError:
            raise HTTPException(
                503,
                detail="模型权重尚未就绪（best.pt 不存在），请等待训练完成后再试",
            )
        except ValueError as e:
            raise HTTPException(422, detail=str(e))

        results.append({
            "filename":     upload.filename,
            "detections":   res["detections"],
            "image_b64":    res["image_b64"],
            "inference_ms": res["inference_ms"],
        })

    return JSONResponse(content=results)
