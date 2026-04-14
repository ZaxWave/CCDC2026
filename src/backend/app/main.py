from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.v1.detect import router as detect_router
from app.api.v1.detect_video import router as detect_video_router

ROOT = Path(__file__).resolve().parents[3]  # → CCDC2026-LightScan/
FRONTEND_PUBLIC = ROOT / "src" / "frontend" / "public"

app = FastAPI(title="LightScan API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 路由
app.include_router(detect_router)
app.include_router(detect_video_router)

# 健康检查
@app.get("/health")
async def health():
    return {"status": "ok"}

# 前端静态文件（最后注册，避免拦截 /api/*）
app.mount("/", StaticFiles(directory=str(FRONTEND_PUBLIC), html=True), name="frontend")
