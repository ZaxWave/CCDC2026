import os
import json
import warnings
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Load environment variables
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path)

# 引入所有路由模块
from app.api.v1.detect import router as detect_router
from app.api.v1.detect_video import router as detect_video_router
from app.api.v1.gis import router as gis_router 
from app.api.v1.auth import router as auth_router  

from .db.database import engine
from .db import models

# 初始化数据库（自动创建 users 表）
models.Base.metadata.create_all(bind=engine)

# 路径配置
ROOT = Path(__file__).resolve().parents[3]  # → CCDC2026-LightScan/
FRONTEND_PUBLIC = ROOT / "src" / "frontend" / "public"

app = FastAPI(title="LightScan API", version="0.1.0")

# ============================================
# CORS 跨域配置（从环境变量读取）
# ============================================
cors_origins_str = os.getenv("CORS_ORIGINS", '["http://localhost:3000","http://localhost:5173","http://localhost:8000"]')
try:
    cors_origins = json.loads(cors_origins_str)
except json.JSONDecodeError:
    cors_origins = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8000"]
    warnings.warn(
        "⚠️ CORS Warning: Invalid CORS_ORIGINS JSON format. Using default development origins.",
        RuntimeWarning
    )

# Security check: warn if CORS allows all origins in production
environment = os.getenv("ENVIRONMENT", "development")
if "*" in cors_origins and environment == "production":
    warnings.warn(
        "⚠️ SECURITY WARNING: CORS is configured to allow all origins (*) in production mode. "
        "This is a security risk. Set specific allowed origins in CORS_ORIGINS environment variable.",
        RuntimeWarning
    )

cors_allow_credentials = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# 注册 API 路由
app.include_router(auth_router)         
app.include_router(detect_router)
app.include_router(detect_video_router)
app.include_router(gis_router)

# 健康检查
@app.get("/health")
async def health():
    return {"status": "ok"}

# 前端静态文件（最后注册，避免拦截 /api/*）
app.mount("/", StaticFiles(directory=str(FRONTEND_PUBLIC), html=True), name="frontend")

# 注册 API 路由
app.include_router(auth_router)         
app.include_router(detect_router)
app.include_router(detect_video_router)
app.include_router(gis_router)

# 健康检查
@app.get("/health")
async def health():
    return {"status": "ok"}

# 前端静态文件（最后注册，避免拦截 /api/*）
app.mount("/", StaticFiles(directory=str(FRONTEND_PUBLIC), html=True), name="frontend")