from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.calificaciones_controller import *
from schemas.calificaciones_schema import CalificacionSchema

router = APIRouter(prefix="/calificaciones", tags=["Calificaciones"])

@router.get("")
def get_all(db: Session = Depends(get_db)):
    return get_calificaciones(db)

@router.post("")
def create(data: CalificacionSchema, db: Session = Depends(get_db)):
    return create_calificacion(data, db)