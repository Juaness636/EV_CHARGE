# Backend/schemas/reservas_schemas.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ReservaCreate(BaseModel):
    estacion_ocm_id: str
    cargador_id: Optional[str] = None
    estacion_nombre: str = ""
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    costo_pagado: float = 0
    estado: str = "pendiente"
    reservante_nombre: Optional[str] = None


class ReservaUpdate(BaseModel):
    estacion_ocm_id: Optional[str] = None
    cargador_id: Optional[str] = None
    estacion_nombre: Optional[str] = None
    fecha_hora_inicio: Optional[datetime] = None
    fecha_hora_fin: Optional[datetime] = None
    costo_pagado: Optional[float] = None
    estado: Optional[str] = None
    reservante_nombre: Optional[str] = None


class ReservaCotizacion(BaseModel):
    estacion_nombre: str = ""
    operador: str = ""
    tipo_cargador: str = ""
    potencia_kw: Optional[float] = None
    duracion_horas: float
