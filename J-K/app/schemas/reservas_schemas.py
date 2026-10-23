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
    # costo_pagado, estado y reservante_nombre los decide el servidor:
    # si el cliente los envía, se ignoran.


class ReservaConfirmadaCreate(ReservaCreate):
    # Transacción devuelta por /api/pagos/procesar con tipo_pago="reserva".
    transaccion_id: str


class ReservaUpdate(BaseModel):
    estacion_ocm_id: Optional[str] = None
    cargador_id: Optional[str] = None
    estacion_nombre: Optional[str] = None
    fecha_hora_inicio: Optional[datetime] = None
    fecha_hora_fin: Optional[datetime] = None


class ReservaCotizacion(BaseModel):
    estacion_nombre: str = ""
    operador: str = ""
    tipo_cargador: str = ""
    potencia_kw: Optional[float] = None
    duracion_horas: float
