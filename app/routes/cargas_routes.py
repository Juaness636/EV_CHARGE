from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.cargas_controller import *
from schemas.cargas_schema import CargaSchema

router = APIRouter(prefix="/cargas", tags=["Cargas"])

@router.get("")
def get_all(db: Session = Depends(get_db)):
    return get_cargas(db)

@router.post("")
def create(data: CargaSchema, db: Session = Depends(get_db)):
    return create_carga(data, db)