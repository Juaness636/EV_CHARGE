# Backend/schemas/cargas_schema.py
from typing import Optional

from pydantic import BaseModel, Field


class CargaCreate(BaseModel):
    """Alta manual de una carga: se registra ya completada."""

    estacion_ocm_id: str
    estacion_nombre: Optional[str] = ""
    kwh_cargados: float = Field(gt=0)
    costo_estimado: Optional[float] = Field(default=None, ge=0)
    duracion_min: Optional[int] = Field(default=None, gt=0, le=24 * 60)
    cargador_id: Optional[str] = None
    notas: Optional[str] = ""


class CargaIniciar(BaseModel):
    """Apertura de una sesión de carga (estado en_curso)."""

    estacion_ocm_id: str
    estacion_nombre: Optional[str] = ""
    cargador_id: Optional[str] = None
    reserva_id: Optional[str] = None
    notas: Optional[str] = ""


class CargaFinalizar(BaseModel):
    """Cierre de la sesión: aquí nacen los kWh y la duración reales."""

    kwh_cargados: float = Field(gt=0)
    duracion_min: Optional[int] = Field(default=None, gt=0, le=24 * 60)
    costo_estimado: Optional[float] = Field(default=None, ge=0)
    notas: Optional[str] = None
