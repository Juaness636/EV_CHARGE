# Backend/schemas/vehiculo_schema.py
from pydantic import BaseModel
from typing import Optional

class VehiculoSchema(BaseModel):
    usuario_id: str  # UUID del usuario dueño en formato string
    marca: str
    modelo: str
    anio: Optional[int] = None
    autonomia_km: Optional[float] = 300.0
    tipo_conector: str
    activo: Optional[bool] = True

    class Config:
        from_attributes = True