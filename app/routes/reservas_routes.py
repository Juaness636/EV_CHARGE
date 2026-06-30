from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.reservas_controller import *
from schemas.reservas_schemas import ReservaSchema

router = APIRouter(prefix="/reservas", tags=["Reservas"])

@router.get("")
def get_all(db: Session = Depends(get_db)):
    return get_reservas(db)

@router.get("/{id}")
def get_one(id: str, db: Session = Depends(get_db)):
    return get_reserva(id, db)

@router.post("")
def create(data: ReservaSchema, db: Session = Depends(get_db)):
    return create_reserva(data, db)

@router.put("/{id}")
def update(id: str, data: ReservaSchema, db: Session = Depends(get_db)):
    return update_reserva(id, data, db)

@router.delete("/{id}")
def delete(id: str, db: Session = Depends(get_db)):
    return delete_reserva(id, db)