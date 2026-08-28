import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.pago_schema import PagoCreateSchema, PagoResponseSchema
from app.utils.jwt import get_current_user  # <-- Importación corregida desde app.utils.jwt
from app.config.database import get_db

router = APIRouter(
    prefix="/api/pagos",
    tags=["Pagos"]
)

@router.post("/procesar", response_model=PagoResponseSchema, status_code=status.HTTP_201_CREATED)
def procesar_pago(
    pago_in: PagoCreateSchema,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)  # Autenticación requerida
):
    """
    Procesa un pago de producto (cargador/wallbox) o cobro anticipado de reserva.
    """
    if pago_in.monto <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto a pagar debe ser mayor a 0."
        )

    transaccion_id = f"TX-EV-{uuid.uuid4().hex[:10].upper()}"

    return {
        "id": 1,
        "transaccion_id": transaccion_id,
        "estado": "aprobado",
        "monto": pago_in.monto,
        "item": pago_in.item,
        "mensaje": f"Pago de ${pago_in.monto:,.0f} COP aprobado exitosamente para {current_user.nombre} mediante {pago_in.metodo.capitalize()}."
    }