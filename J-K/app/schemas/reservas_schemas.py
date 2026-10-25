# Backend/schemas/reservas_schemas.py
from pydantic import BaseModel, Field
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
    # Con estacion_ocm_id el precio se calcula con los datos del servidor (es el que se cobra).
    # Sin él, los demás campos solo sirven para una estimación orientativa.
    estacion_ocm_id: Optional[str] = None
    cargador_id: Optional[str] = None
    estacion_nombre: str = ""
    operador: str = ""
    tipo_cargador: str = ""
    potencia_kw: Optional[float] = None
    duracion_horas: float = Field(..., gt=0, le=24)


class EscaneoQR(BaseModel):
    # Texto leído del QR del cargador, o el código manual de 10 caracteres impreso debajo.
    codigo: str = Field(..., min_length=1, max_length=300)
