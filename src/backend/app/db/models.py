# src/backend/app/db/models.py
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.dialects.postgresql import JSONB 
from datetime import datetime
from .database import Base

class DiseaseRecord(Base):
    __tablename__ = "disease_records"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    
    # 时空 GIS 属性
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    lat = Column(Float, index=True)  # 纬度
    lng = Column(Float, index=True)  # 经度
    
    # 病害属性
    label = Column(String, index=True)       # D00, D10, D20, D40
    label_cn = Column(String)                # 中文标签
    confidence = Column(Float)               # 置信度
    color_hex = Column(String)               # 前端展示色
    bbox = Column(JSONB)                     # 使用 PG 高级 JSONB 存储边界框 [x1, y1, x2, y2]