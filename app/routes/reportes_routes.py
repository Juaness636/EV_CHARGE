from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.reportes_controller import *
from schemas.reportes_schema import ReporteSchema

router = APIRouter(prefix="/reportes", tags=["Reportes"])

@router.get("")
def get_all(db: Session = Depends(get_db)):
    return get_reportes(db)

@router.get("/{id}")
def get_one(id: str, db: Session = Depends(get_db)):
    return get_reporte(id, db)

@router.post("")
def create(data: ReporteSchema, db: Session = Depends(get_db)):
    return create_reporte(data, db)

@router.put("/{id}")
def update(id: str, data: ReporteSchema, db: Session = Depends(get_db)):
    return update_reporte(id, data, db)

@router.delete("/{id}")
def delete(id: str, db: Session = Depends(get_db)):
    return delete_reporte(id, db)