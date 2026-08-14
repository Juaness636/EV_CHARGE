# Backend/controllers/estado_controller.py
from sqlalchemy.orm import Session, joinedload

from app.models.estacion_propia_model import EstacionPropia
from app.models.reporte_model import Reportes
from app.models.reserva_model import Reservas
from app.models.utils import ahora_utc


def _nombre_completo(usuario) -> str:
    if not usuario:
        return "Usuario eliminado"
    if usuario.apellido and usuario.apellido.strip():
        return f"{usuario.nombre} {usuario.apellido}"
    return usuario.nombre


def obtener_estado_estacion(db: Session, estacion_id: str):
    propia = db.query(EstacionPropia).filter(EstacionPropia.id == estacion_id).first()
    if propia and not propia.activa:
        return {"estado": "mantenimiento"}

    reporte = db.query(Reportes).filter(
        Reportes.estacion_ocm_id == estacion_id,
        Reportes.estado == "abierto",
        Reportes.tipo.in_(["averia", "fuera_servicio"]),
    ).first()
    if reporte:
        return {"estado": "mantenimiento"}

    ahora = ahora_utc()
    reserva = db.query(Reservas).options(joinedload(Reservas.usuario)).filter(
        Reservas.estacion_ocm_id == estacion_id,
        Reservas.estado == "activa",
        Reservas.fecha_hora_inicio <= ahora,
        Reservas.fecha_hora_fin >= ahora,
    ).first()
    if reserva:
        return {"estado": "reservada", "reservado_por": _nombre_completo(reserva.usuario)}

    return {"estado": "disponible"}