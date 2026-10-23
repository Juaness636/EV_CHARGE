# Backend/controllers/estacion_estado_controller.py
"""Cambio de estado de una estación de empresa: la única vía para admin y empresa.

Aplica RN-E03 (necesita un cargador disponible para activarse), RN-E04 (motivo
obligatorio) y RN-E06 (cancelar reservas futuras y notificar). El incidente bloqueante
llama esta misma función, así no existen dos comportamientos para el mismo cambio.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.controllers.empresa_estaciones_controller import (
    cancelar_reservas_futuras_por_estacion,
    cargadores_efectivos,
)
from app.controllers.historial_controller import registrar_historial
from app.models.estacion_propia_model import EstacionPropia
from app.utils.constantes import (
    ACCION_HISTORIAL_CAMBIAR_ESTADO,
    CARGADOR_ESTADO_DISPONIBLE,
    ESTADO_ESTACION_ACTIVA,
    ESTADOS_ESTACION,
    ESTADOS_QUE_NO_OPERAN,
    LONGITUD_MINIMA_MOTIVO,
)


def cambiar_estado(
    db: Session,
    estacion: EstacionPropia,
    estado: str,
    motivo: str,
    *,
    actor_id: str | None = None,
    actor_nombre: str = "",
    accion: str = ACCION_HISTORIAL_CAMBIAR_ESTADO,
    detalle_extra: dict | None = None,
) -> dict:
    """Deja la estación en `estado`, con sus reglas, y registra el cambio en el historial.

    No commitea: quien llama decide el borde de la transacción.
    """
    if estado not in ESTADOS_ESTACION:
        raise HTTPException(
            status_code=400,
            detail=f"Estado de estación no válido. Use uno de: {', '.join(ESTADOS_ESTACION)}.",
        )

    if estado == ESTADO_ESTACION_ACTIVA and not any(
        c["estado"] == CARGADOR_ESTADO_DISPONIBLE for c in cargadores_efectivos(db, estacion)
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "No se puede activar: la estación necesita al menos un cargador "
                "en estado 'disponible' (RN-E03)."
            ),
        )

    motivo_limpio = (motivo or "").strip()
    if len(motivo_limpio) < LONGITUD_MINIMA_MOTIVO:
        raise HTTPException(
            status_code=400,
            detail=f"El motivo del cambio de estado es obligatorio y debe tener al menos {LONGITUD_MINIMA_MOTIVO} caracteres (RN-E04).",
        )

    anterior = estacion.estado
    canceladas = 0
    if estado in ESTADOS_QUE_NO_OPERAN:
        canceladas = cancelar_reservas_futuras_por_estacion(db, estacion, motivo_limpio)

    estacion.estado = estado
    # `activa` se mantiene sincronizada con `estado` mientras el campo exista.
    estacion.activa = estado == ESTADO_ESTACION_ACTIVA

    detalle = {"antes": anterior, "despues": estado, "reservas_canceladas": canceladas}
    if detalle_extra:
        detalle.update(detalle_extra)
    registrar_historial(
        db,
        empresa_id=estacion.empresa_id,
        usuario_id=actor_id,
        usuario_nombre=actor_nombre,
        estacion=estacion,
        accion=accion,
        motivo=motivo_limpio,
        detalle=detalle,
    )
    return {
        "id": estacion.id,
        "estado": estado,
        "activa": estacion.activa,
        "reservas_canceladas": canceladas,
    }
