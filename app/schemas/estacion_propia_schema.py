# Backend/schemas/estacion_propia_schema.py
from pydantic import BaseModel
from typing import Optional

class EstacionPropiaSchema(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    lat: float
    lon: float
    tipo_conector: str
    potencia_kw: float
    descripcion: Optional[str] = None
    activa: Optional[bool] = True

    class Config:
        from_attributes = True