# Backend/schemas/incidente_schema.py
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.utils.constantes import ESTADOS_REPORTE, PRIORIDADES_INCIDENTE, TIPOS_INCIDENTE


class IncidenteCreate(BaseModel):
    estacion_id: str
    titulo: str = Field(min_length=3, max_length=150)
    descripcion: Optional[str] = ""
    tipo: str = "falla"
    prioridad: str = "media"
    cargador_id: Optional[str] = None
    bloquea_estacion: bool = False

    @field_validator("tipo")
    @classmethod
    def _tipo_valido(cls, v: str) -> str:
        if v not in TIPOS_INCIDENTE:
            raise ValueError(f"Tipo no válido. Use: {', '.join(TIPOS_INCIDENTE)}")
        return v

    @field_validator("prioridad")
    @classmethod
    def _prioridad_valida(cls, v: str) -> str:
        if v not in PRIORIDADES_INCIDENTE:
            raise ValueError(f"Prioridad no válida. Use: {', '.join(PRIORIDADES_INCIDENTE)}")
        return v


class IncidenteEstadoUpdate(BaseModel):
    estado: str
    solucion: Optional[str] = None


class ReporteEstadoUpdate(BaseModel):
    estado: str

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_REPORTE:
            raise ValueError("Estado de reporte no válido")
        return v


class IncidenteOut(BaseModel):
    id: str
    estacion_id: str
    estacion_nombre: str
    cargador_id: Optional[str] = None
    cargador_numero: Optional[int] = None
    reporte_id: Optional[str] = None
    tipo: str
    titulo: str
    descripcion: Optional[str] = None
    prioridad: str
    bloquea_estacion: bool
    estado: str
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None
    solucion: Optional[str] = None
    puede_reactivar: bool = False

    class Config:
        from_attributes = True
