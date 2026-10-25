# Backend/routes/estado_routes.py
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.estado_controller import obtener_estado_estacion, obtener_estados_lote

router = APIRouter(tags=["Estado de estación"])


class EstadosLote(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=200)


@router.post("/estado/lote")
def estados_lote(data: EstadosLote, db: Session = Depends(get_db)):
    """Estado de muchas estaciones a la vez: el mapa lo usa para verse en tiempo real."""
    return obtener_estados_lote(db, data.ids)


@router.get("/estado/{estacion_id}")
def estado_estacion(estacion_id: str, db: Session = Depends(get_db)):
    return obtener_estado_estacion(db, estacion_id)