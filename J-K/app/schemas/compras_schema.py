from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EstadoPedido = Literal["pendiente", "confirmado", "enviado", "entregado", "cancelado"]


class EnvioCompra(BaseModel):
    """Datos que el comprador entrega al pagar para que el admin coordine el envío."""

    contacto_nombre: str = Field(..., min_length=3, max_length=120)
    contacto_telefono: str = Field(..., pattern=r"^\+?\d{7,15}$")
    direccion_envio: str = Field(..., min_length=5, max_length=200)
    ciudad: str = Field(..., min_length=2, max_length=80)
    notas_cliente: str | None = Field(None, max_length=500)


class MensajeCompraOut(BaseModel):
    id: str
    es_admin: bool
    texto: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MensajeCompraCrear(BaseModel):
    texto: str = Field(..., min_length=1, max_length=1000)


class CompraOut(BaseModel):
    id: str
    producto: str
    cantidad: int = 1
    monto: float
    metodo: str
    metodo_id: str | None = None
    transaccion_id: str
    estado: str
    estado_pedido: str = "pendiente"
    contacto_nombre: str | None = None
    contacto_telefono: str | None = None
    direccion_envio: str | None = None
    ciudad: str | None = None
    notas_cliente: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
    mensajes_sin_leer: int = 0

    model_config = ConfigDict(from_attributes=True)


class CompraDetalleOut(CompraOut):
    mensajes: list[MensajeCompraOut] = []


class CompradorOut(BaseModel):
    # Solo datos de contacto: nunca se expone password_hash ni reset_pin.
    id: str
    nombre: str
    apellido: str | None = None
    email: str

    model_config = ConfigDict(from_attributes=True)


class AdminCompraOut(CompraOut):
    comprador: CompradorOut | None = None


class AdminCompraDetalleOut(AdminCompraOut):
    mensajes: list[MensajeCompraOut] = []


class AdminCompraUpdate(BaseModel):
    estado_pedido: EstadoPedido
