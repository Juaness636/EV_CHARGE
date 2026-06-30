# Backend/schemas/empresa_schema.py
from pydantic import BaseModel
from typing import Optional

class EmpresaSchema(BaseModel):
    nombre: str
    direccion: Optional[str] = None
    lat: float
    lon: float
    tipo_conector: Optional[str] = None
    potencia_kw: Optional[float] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = True

    class Config:
        from_attributes = True