# Backend/schemas/reportes_schema.py
from pydantic import BaseModel
from typing import Optional


class ReporteCreate(BaseModel):
    estacion_ocm_id: str
    estacion_nombre: Optional[str] = ""
    tipo: str
    descripcion: Optional[str] = ""


class ReporteUpdate(BaseModel):
    # El estado del reporte solo lo cambia el administrador o la empresa.
    tipo: Optional[str] = None
    descripcion: Optional[str] = None