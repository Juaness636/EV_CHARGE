# Backend/schemas/estacion_empresa_schema.py
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.empresa_schema import CargadorCreate, CargadorOut
from app.utils.constantes import ESTADOS_ESTACION


class EstacionEmpresaCreate(BaseModel):
    """RN-E03: una estación nace con al menos un cargador."""

    nombre: str = Field(min_length=2, max_length=150)
    direccion: Optional[str] = None
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    descripcion: Optional[str] = ""
    cargadores: List[CargadorCreate] = Field(min_length=1)
    estado: Optional[str] = None

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ESTADOS_ESTACION:
            raise ValueError(f"Estado no válido. Use: {', '.join(ESTADOS_ESTACION)}")
        return v

    @field_validator("cargadores")
    @classmethod
    def _numeros_unicos(cls, v: List[CargadorCreate]) -> List[CargadorCreate]:
        numeros = [c.numero for c in v]
        if len(numeros) != len(set(numeros)):
            raise ValueError("El número de cargador no puede repetirse en la misma estación")
        return v


class EstacionEmpresaUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=150)
    direccion: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lon: Optional[float] = Field(default=None, ge=-180, le=180)
    descripcion: Optional[str] = None

    # `operador` y `empresa_id` no se editan nunca desde el cliente.


class EstacionEstadoUpdate(BaseModel):
    """RN-E04: cambiar el estado exige un motivo escrito."""

    estado: str
    motivo: str = Field(min_length=10)

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_ESTACION:
            raise ValueError(f"Estado no válido. Use: {', '.join(ESTADOS_ESTACION)}")
        return v

    @field_validator("motivo")
    @classmethod
    def _motivo_sustancioso(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("El motivo debe tener al menos 10 caracteres")
        return v.strip()


class EstacionEliminar(BaseModel):
    motivo: str = Field(min_length=10)


class EstacionEmpresaOut(BaseModel):
    id: str
    nombre: str
    direccion: Optional[str] = None
    lat: float
    lon: float
    descripcion: Optional[str] = None
    operador: Optional[str] = None
    estado: str
    activa: bool
    empresa_id: Optional[str] = None
    eliminada: bool = False
    tipo_conector: Optional[str] = None
    potencia_kw: Optional[float] = None
    created_at: Optional[datetime] = None
    cargadores: List[CargadorOut] = []
    total_cargadores: int = 0
    cargadores_disponibles: int = 0
    incidentes_abiertos: int = 0

    class Config:
        from_attributes = True


class HistorialOut(BaseModel):
    id: str
    estacion_id: str
    estacion_nombre: str
    direccion: str
    accion: str
    motivo: str
    usuario_nombre: str
    detalle: Optional[dict] = None
    fecha: datetime

    class Config:
        from_attributes = True
