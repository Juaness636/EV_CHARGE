from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.metodo_pago_controller import *
from schemas.metodos_pago_schema import MetodoPagoSchema

router = APIRouter(prefix="/metodos-pago", tags=["Métodos de Pago"])

from models.models import MetodosPago

def create_metodo(data, db):
    try:
        new = MetodosPago(**data.model_dump())
        db.add(new)
        db.commit()
        db.refresh(new)
        return new
    except Exception as e:
        return {"error": str(e)}
@router.get("")

def get_all(db: Session = Depends(get_db)):
    return get_metodos(db)

@router.get("/{id}")
def get_one(id: str, db: Session = Depends(get_db)):
    return get_metodo(id, db)

@router.post("")
def create(data: MetodoPagoSchema, db: Session = Depends(get_db)):
    return create_metodo(data, db)

@router.put("/{id}")
def update(id: str, data: MetodoPagoSchema, db: Session = Depends(get_db)):
    return update_metodo(id, data, db)

@router.delete("/{id}")
def delete(id: str, db: Session = Depends(get_db)):
    return delete_metodo(id, db)