# Backend/schemas/incidente_schema.py
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.utils.constantes import (
    ESTADOS_INCIDENTE,
    ESTADOS_REPORTE_EMPRESA,
    PRIORIDADES_INCIDENTE,
    TIPOS_INCIDENTE,
)


class IncidenteCreate(BaseModel):
    estacion_id: str
    titulo: str = Field(min_length=3, max_length=150)
    descripcion: Optional[str] = Field(default="", max_length=2000)
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
    solucion: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_INCIDENTE:
            raise ValueError(f"Estado no válido. Use: {', '.join(ESTADOS_INCIDENTE)}")
        return v


class ReporteEstadoUpdate(BaseModel):
    estado: str

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_REPORTE_EMPRESA:
            raise ValueError(f"Estado de reporte no válido. Use: {', '.join(ESTADOS_REPORTE_EMPRESA)}")
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


class IncidentesPagina(BaseModel):
    total: int
    page: int
    limit: int
    resultados: List[IncidenteOut]


class ReporteEmpresaOut(BaseModel):
    id: str
    estacion_ocm_id: str
    estacion_nombre: str
    tipo: str
    descripcion: str
    estado: str
    fecha: Optional[datetime] = None
    # Privacidad: el nombre de quien reporta, nunca su correo.
    usuario_nombre: str


class ReportesPagina(BaseModel):
    total: int
    page: int
    limit: int
    resultados: List[ReporteEmpresaOut]


class ReporteEstadoOut(BaseModel):
    id: str
    estado: str
