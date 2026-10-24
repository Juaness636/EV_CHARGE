from pydantic import BaseModel, Field
from typing import Optional

from app.schemas.reservas_schemas import ReservaCreate

class PagoCreateSchema(BaseModel):
    tipo_pago: str = Field(..., description="'producto' o 'reserva'")
    item: str = Field(..., description="Nombre del producto o estación a pagar")
    monto: float = Field(..., gt=0, description="Monto en COP a cobrar")
    metodo: str = Field(..., description="'tarjeta', 'nequi', 'pse'")
    metodo_id: Optional[str] = Field(None, description="ID de un método guardado del usuario")
    referencia_id: Optional[str] = Field(None, description="ID de la reserva o código de referencia")
    reserva: Optional[ReservaCreate] = Field(None, description="Reserva que se paga (obligatoria si tipo_pago='reserva')")

class PagoResponseSchema(BaseModel):
    id: int
    transaccion_id: str
    estado: str
    monto: float
    item: str
    mensaje: str

    class Config:
        from_attributes = True
