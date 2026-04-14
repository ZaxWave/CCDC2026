from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import DiseaseRecord

router = APIRouter(prefix="/api/v1/gis", tags=["gis"])

@router.get("/records")
def get_all_records(db: Session = Depends(get_db)):
    """获取所有含有坐标的病害记录"""
    records = db.query(DiseaseRecord).filter(
        DiseaseRecord.lat != 0.0, 
        DiseaseRecord.lng != 0.0
    ).all()
    return records