import sys
import time
import base64
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[4]  # → CCDC2026-LightScan/
sys.path.insert(0, str(ROOT))

from inference import LightScanInference

# RDD2022 类别中文映射
LABEL_CN = {
    "D00": "纵向裂缝",
    "D10": "横向裂缝",
    "D20": "龟裂",
    "D40": "坑槽",
}

# CSS tag class 映射（与前端保持一致）
LABEL_TAG = {
    "D00": "tag-crack",
    "D10": "tag-crack",
    "D20": "tag-crack",
    "D40": "tag-pothole",
}

_engine: LightScanInference | None = None


def get_engine() -> LightScanInference:
    """懒加载单例：首次调用时加载模型，后续复用。"""
    global _engine
    if _engine is None:
        _engine = LightScanInference()
    return _engine


def run_detect(img_bytes: bytes, conf: float = 0.25) -> dict:
    """
    对单张图片执行推理。

    Returns
    -------
    dict 含以下字段:
        detections  : list[{label, label_cn, tag, conf, bbox}]
        image_b64   : 标注后图片的 base64 字符串（data URI）
        inference_ms: 推理耗时（毫秒）
    """
    engine = get_engine()

    # bytes → numpy BGR
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("无法解码图片，请检查文件格式")

    t0 = time.perf_counter()
    result = engine.run(img, conf=conf)
    inference_ms = round((time.perf_counter() - t0) * 1000, 1)

    # 解析检测框
    detections = []
    boxes = result.boxes
    if boxes is not None and len(boxes):
        names = result.names  # {0: "D00", 1: "D10", ...}
        for box in boxes:
            cls_id = int(box.cls[0])
            label  = names[cls_id]
            confidence = round(float(box.conf[0]), 3)
            x1, y1, x2, y2 = [round(float(v)) for v in box.xyxy[0]]
            detections.append({
                "label":    label,
                "label_cn": LABEL_CN.get(label, label),
                "tag":      LABEL_TAG.get(label, "tag-crack"),
                "conf":     confidence,
                "bbox":     [x1, y1, x2, y2],
            })

    # 将标注图编码为 base64
    annotated = result.plot()                       # numpy BGR with boxes
    annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
    _, buf = cv2.imencode(".jpg", annotated_rgb, [cv2.IMWRITE_JPEG_QUALITY, 88])
    image_b64 = "data:image/jpeg;base64," + base64.b64encode(buf).decode()

    return {
        "detections":   detections,
        "image_b64":    image_b64,
        "inference_ms": inference_ms,
    }
