# Backend/controllers/estado_controller.py
from sqlalchemy.orm import Session, joinedload

from app.controllers.empresa_estaciones_controller import cargadores_effectivos
from app.models.estacion_propia_model import EstacionPropia
from app.models.reserva_model import Reservas
from app.models.estado_estacion_model import EstadoEstacion
from app.models.utils import ahora_utc
from app.utils.constantes import (
    ESTADO_ESTACION_INACTIVA,
    ESTADO_RESERVA_ACTIVA,
    ESTADOS_CARGADOR,
    ESTADOS_QUE_NO_OPERAN,
)


def _nombre_completo(usuario) -> str:
    if not usuario:
        return "Usuario eliminado"
    if usuario.apellido and usuario.apellido.strip():
        return f"{usuario.nombre} {usuario.apellido}"
    return usuario.nombre


def obtener_estado_estacion(db: Session, estacion_id: str):
    estado_ocm = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == estacion_id).first()
    if estado_ocm and estado_ocm.estado in ESTADOS_QUE_NO_OPERAN:
        return {"estado": estado_ocm.estado}

    # Una estación con borrado lógico (RN-E08) deja de ser un punto donde cargar.
    propia = (
        db.query(EstacionPropia)
        .options(joinedload(EstacionPropia.cargadores))
        .filter(EstacionPropia.id == estacion_id)
        .first()
    )
    if propia and propia.eliminada:
        return {"estado": ESTADO_ESTACION_INACTIVA}

    disponibles: list[dict] = []
    if propia:
        if propia.estado in ESTADOS_QUE_NO_OPERAN:
            return {"estado": propia.estado}
        # La reserva sigue siendo por estación (decisión 3.4-A), pero si ningún cargador
        # está disponible la estación tampoco lo está aunque su estado diga 'activa'.
        disponibles = [c for c in cargadores_effectivos(propia) if c["estado"] == ESTADOS_CARGADOR[0]]
        if cargadores_effectivos(propia) and not disponibles:
            return {"estado": ESTADO_ESTACION_MANTENIMIENTO, "cargadores_disponibles": 0}

    ahora = ahora_utc()
    reserva = db.query(Reservas).options(joinedload(Reservas.usuario)).filter(
        Reservas.estacion_ocm_id == estacion_id,
        Reservas.estado == ESTADO_RESERVA_ACTIVA,
        Reservas.fecha_hora_inicio <= ahora,
        Reservas.fecha_hora_fin >= ahora,
    ).first()
    if reserva:
        return {"estado": "reservada", "reservado_por": _nombre_completo(reserva.usuario)}

    resultado = {"estado": "disponible"}
    if propia:
        resultado["cargadores_disponibles"] = len(disponibles)
    return resultado
