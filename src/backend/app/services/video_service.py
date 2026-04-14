"""
video_service.py
视频推理服务

两种抽帧模式：
  ocr   — 读取视频内速度叠加字幕，按行驶距离均匀抽帧（依赖 PaddleOCR）
  timed — 根据大致车速和目标间隔米数计算截帧间隔，不依赖 OCR
"""

import base64
import re
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

import cv2
import numpy as np

from app.services.inference_service import run_detect

# ── 常量 ───────────────────────────────────────────────────────────────────
OCR_INTERVAL = 15    # 每 N 帧做一次 OCR（30fps 下约 0.5 秒）
OCR_PROBES   = 5     # 自动检测速度区域时的采样帧数
REGION_PAD   = 20    # 自动检测区域时向外扩展的像素边距
MAX_FRAMES   = 300   # 单次最多推理帧数，防止超大视频耗尽内存


# ── 视频 I/O ──────────────────────────────────────────────────────────────

@contextmanager
def _open_video(video_bytes: bytes) -> Generator[cv2.VideoCapture, None, None]:
    """将视频字节写入临时文件，打开 VideoCapture，退出时自动清理。"""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp.write(video_bytes)
        tmp_path = Path(tmp.name)

    cap = cv2.VideoCapture(str(tmp_path))
    try:
        if not cap.isOpened():
            raise ValueError("无法打开视频文件，请检查格式是否为 MP4")
        yield cap
    finally:
        cap.release()
        tmp_path.unlink(missing_ok=True)


def _frame_to_bytes(frame: np.ndarray) -> bytes:
    """将 cv2 BGR 帧编码为 JPEG 字节。"""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return buf.tobytes()


def get_first_frame(video_bytes: bytes) -> dict:
    """
    读取视频第一帧，返回 base64 data URI 及原始分辨率。
    供前端在画布上手动框选速度区域使用。

    Returns: {"frame_b64": "data:image/jpeg;base64,...", "width": W, "height": H}
    """
    with _open_video(video_bytes) as cap:
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        ret, frame = cap.read()
        if not ret:
            raise ValueError("视频为空或第一帧读取失败")
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        b64 = "data:image/jpeg;base64," + base64.b64encode(buf).decode()

    return {"frame_b64": b64, "width": w, "height": h}


# ── OCR 工具 ──────────────────────────────────────────────────────────────

def _iter_ocr_items(result):
    """
    统一解析 PaddleOCR 结果，yield (text, score, poly)。
    兼容 PaddleOCR 2.x（list 格式）和 3.x（dict 格式）。
    """
    for page in (result or []):
        if isinstance(page, dict):
            for text, score, poly in zip(
                page.get("rec_texts", []),
                page.get("rec_scores", []),
                page.get("rec_polys", []),
            ):
                yield text, score, poly
        elif isinstance(page, list):
            for item in page:
                try:
                    box, (text, score) = item
                    yield text, score, np.array(box, dtype=np.float32)
                except Exception:
                    continue


def _extract_speed_kmh(ocr_result) -> float | None:
    """
    从 OCR 结果中提取速度值（统一换算为 km/h）。
    支持 KM/H、KMH、MPH 等常见变体，失败返回 None。
    """
    texts = [t for t, s, _ in _iter_ocr_items(ocr_result) if s > 0.3]
    if not texts:
        return None

    full_text = " ".join(texts)

    m = re.search(r"(\d+)\s*[KX]M.?H", full_text, re.IGNORECASE)
    if m:
        return float(m.group(1))

    m = re.search(r"(\d+)\s*MPH", full_text, re.IGNORECASE)
    if m:
        return float(m.group(1)) * 1.60934

    return None


def _auto_detect_speed_region(
    cap: cv2.VideoCapture,
    ocr_engine,
) -> tuple[int, int, int, int] | None:
    """
    均匀采样视频若干帧做分块 OCR，寻找速度数字所在区域。
    返回 (x1, y1, x2, y2)，找不到返回 None。
    """
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fw    = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    fh    = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    probe_indices = [
        int(total * i / max(OCR_PROBES - 1, 1))
        for i in range(OCR_PROBES)
    ]

    boxes = []
    for idx in probe_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            continue

        # 3×3 分块 OCR，避免小字在全图模式下被漏检
        for ri in range(3):
            for ci in range(3):
                y0, y1_ = ri * fh // 3, (ri + 1) * fh // 3
                x0, x1_ = ci * fw // 3, (ci + 1) * fw // 3
                tile = frame[y0:y1_, x0:x1_]
                try:
                    res = ocr_engine.ocr(tile)
                except Exception:
                    continue
                for text, score, poly in _iter_ocr_items(res):
                    if score > 0.3 and re.search(r"\d+\s*[KX]M.?H", text, re.IGNORECASE):
                        pts = np.array(poly, dtype=np.float32).reshape(-1, 2)
                        boxes.append((
                            x0 + int(pts[:, 0].min()),
                            y0 + int(pts[:, 1].min()),
                            x0 + int(pts[:, 0].max()),
                            y0 + int(pts[:, 1].max()),
                        ))

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # 重置，避免影响后续逐帧读取

    if not boxes:
        return None

    return (
        max(0,  min(b[0] for b in boxes) - REGION_PAD),
        max(0,  min(b[1] for b in boxes) - REGION_PAD),
        min(fw, max(b[2] for b in boxes) + REGION_PAD),
        min(fh, max(b[3] for b in boxes) + REGION_PAD),
    )


# ── 主要对外接口 ──────────────────────────────────────────────────────────

def detect_video_ocr(
    video_bytes: bytes,
    interval_meters: float = 5.0,
    ocr_region: tuple[int, int, int, int] | None = None,
) -> dict:
    """
    OCR 距离模式：识别视频内速度字幕，按行驶距离均匀抽帧，逐帧推理。

    Parameters
    ----------
    video_bytes     : 视频文件的原始字节
    interval_meters : 每隔多少米抽一帧
    ocr_region      : 手动指定的速度区域 (x1,y1,x2,y2)；None 则自动检测

    Returns
    -------
    {"status": "ok",         "results": [...], "total_frames": N}
    {"status": "ocr_failed", "results": [],    "total_frames": 0}
    """
    from paddleocr import PaddleOCR  # 懒导入：仅 OCR 模式时才加载，不拖慢服务启动

    ocr_engine = PaddleOCR(
        use_textline_orientation=False, lang="en", enable_mkldnn=False
    )

    with _open_video(video_bytes) as cap:
        fps            = cap.get(cv2.CAP_PROP_FPS) or 30.0
        secs_per_frame = 1.0 / fps

        # 确定速度区域（自动检测或手动指定）
        if ocr_region is None:
            ocr_region = _auto_detect_speed_region(cap, ocr_engine)
            if ocr_region is None:
                return {"status": "ocr_failed", "results": [], "total_frames": 0}

        rx1, ry1, rx2, ry2 = ocr_region
        results        = []
        cumul_m        = 0.0
        next_extract_m = 0.0
        speed_ms: float | None = None
        frame_idx      = 0
        extracted_n    = 0

        while extracted_n < MAX_FRAMES:
            ret, frame = cap.read()
            if not ret:
                break

            # 每隔 OCR_INTERVAL 帧识别一次速度（其余帧使用前向填充）
            if frame_idx % OCR_INTERVAL == 0:
                crop = frame[ry1:ry2, rx1:rx2]
                try:
                    ocr_res = ocr_engine.ocr(crop)
                    kmh     = _extract_speed_kmh(ocr_res)
                    if kmh is not None:
                        speed_ms = kmh / 3.6
                except Exception:
                    pass

            # 用速度积分估算行驶距离
            if speed_ms is not None:
                cumul_m += speed_ms * secs_per_frame

            # 达到距离阈值则抽帧推理
            if cumul_m >= next_extract_m:
                extracted_n += 1
                frame_name   = f"frame_{extracted_n:04d}_{int(next_extract_m)}m.jpg"
                res          = run_detect(_frame_to_bytes(frame))
                res["filename"] = frame_name
                results.append(res)
                next_extract_m += interval_meters

            frame_idx += 1

    return {"status": "ok", "results": results, "total_frames": extracted_n}


def detect_video_timed(
    video_bytes: bytes,
    approx_speed_kmh: float,
    interval_meters: float,
) -> list[dict]:
    """
    时间估算模式：根据大致车速和目标间隔米数计算截帧频率，逐帧推理。

    Parameters
    ----------
    video_bytes      : 视频文件的原始字节
    approx_speed_kmh : 大致车速（km/h）
    interval_meters  : 期望的抽帧间隔（米）
    """
    results = []

    with _open_video(video_bytes) as cap:
        fps          = cap.get(cv2.CAP_PROP_FPS) or 30.0
        speed_ms     = approx_speed_kmh / 3.6
        # interval_meters / speed_ms = 每次抽帧间隔秒数；× fps = 帧数间隔
        frame_interval = max(1, int(round(interval_meters / speed_ms * fps)))

        frame_idx   = 0
        extracted_n = 0

        while extracted_n < MAX_FRAMES:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                extracted_n  += 1
                est_dist_m    = int(frame_idx / fps * speed_ms)
                frame_name    = f"frame_{extracted_n:04d}_{est_dist_m}m.jpg"
                res           = run_detect(_frame_to_bytes(frame))
                res["filename"] = frame_name
                results.append(res)

            frame_idx += 1

    return results
