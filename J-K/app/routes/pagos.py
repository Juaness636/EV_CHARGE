import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.pago_schema import PagoCreateSchema, PagoResponseSchema
from app.utils.jwt import get_current_user  # <-- Importación corregida desde app.utils.jwt
from app.config.database import get_db
from app.controllers.notificaciones_controller import crear_notificacion
from app.models.metodo_pago_model import MetodosPago
from app.models.compra_model import Compras
from app.models.pago_reserva_model import PagosReserva
from app.controllers.reservas_controller import utc_sin_zona, validar_reserva
from app.services.tarifas_service import cotizar_reserva_servidor

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
    if pago_in.tipo_pago not in {"producto", "reserva"}:
        raise HTTPException(status_code=400, detail="Tipo de pago no válido.")

    if pago_in.monto <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto a pagar debe ser mayor a 0."
        )

    monto = pago_in.monto
    if pago_in.tipo_pago == "reserva":
        reserva = pago_in.reserva
        if reserva is None:
            raise HTTPException(
                status_code=400,
                detail="Faltan los datos de la reserva. Actualiza la aplicación e inténtalo de nuevo.",
            )
        # Antes de cobrar se comprueba que la reserva sea posible (horario, estado, cupo).
        validar_reserva(db, current_user.id, reserva)
        horas = (reserva.fecha_hora_fin - reserva.fecha_hora_inicio).total_seconds() / 3600
        # El precio lo calcula el servidor con los datos reales del cargador, nunca la app.
        monto = float(cotizar_reserva_servidor(db, reserva.estacion_ocm_id, reserva.cargador_id, horas)["total"])
        if abs(pago_in.monto - monto) > 0.5:
            raise HTTPException(
                status_code=409,
                detail=f"El valor de la reserva cambió. El total actual es ${monto:,.0f} COP; revisa la cotización e inténtalo de nuevo.",
            )

    metodo_guardado = None
    if pago_in.metodo_id:
        metodo_guardado = db.query(MetodosPago).filter(
            MetodosPago.id == pago_in.metodo_id,
            MetodosPago.usuario_id == current_user.id,
            MetodosPago.estado.is_(True),
        ).first()
        if not metodo_guardado:
            raise HTTPException(status_code=400, detail="El método de pago seleccionado no es válido.")

    transaccion_id = f"TX-EV-{uuid.uuid4().hex[:10].upper()}"

    tipo = "compra" if pago_in.tipo_pago == "producto" else "pago"
    titulo = "Compra completada" if tipo == "compra" else "Pago realizado"
    crear_notificacion(
        db,
        current_user.id,
        titulo,
        f"Se aprobó el pago de ${monto:,.0f} COP por {pago_in.item}.",
        tipo,
    )
    if pago_in.tipo_pago == "producto":
        db.add(Compras(
            usuario_id=current_user.id,
            producto=pago_in.item,
            monto=pago_in.monto,
            metodo=metodo_guardado.tipo if metodo_guardado else pago_in.metodo,
            metodo_id=pago_in.metodo_id,
            transaccion_id=transaccion_id,
            estado="aprobada",
        ))
    else:
        # Queda registrado para que /reservar-confirmada pueda verificarlo:
        # sin un pago aprobado y sin usar no se activa ninguna reserva.
        db.add(PagosReserva(
            usuario_id=current_user.id,
            transaccion_id=transaccion_id,
            monto=monto,
            metodo=metodo_guardado.tipo if metodo_guardado else pago_in.metodo,
            metodo_id=pago_in.metodo_id,
            estado="aprobado",
            estacion_ocm_id=reserva.estacion_ocm_id,
            cargador_id=reserva.cargador_id or f"{reserva.estacion_ocm_id}-general",
            fecha_hora_inicio=utc_sin_zona(reserva.fecha_hora_inicio),
            fecha_hora_fin=utc_sin_zona(reserva.fecha_hora_fin),
        ))
    db.commit()

    return {
        "id": 1,
        "transaccion_id": transaccion_id,
        "estado": "aprobado",
        "monto": monto,
        "item": pago_in.item,
        "mensaje": f"Pago de ${monto:,.0f} COP aprobado exitosamente para {current_user.nombre} mediante {pago_in.metodo.capitalize()}."
    }
