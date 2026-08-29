# Backend/schemas/calificaciones_schema.py
from pydantic import BaseModel
from typing import Optional


class CalificacionCreate(BaseModel):
    estacion_ocm_id: str
    estacion_nombre: Optional[str] = ""
    puntaje: int
    comentario: Optional[str] = ""


class CalificacionUpdate(BaseModel):
    puntaje: int
    comentario: Optional[str] = None