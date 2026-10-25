# Backend/controllers/estado_controller.py
from sqlalchemy.orm import Session, joinedload

from app.models.estacion_propia_model import EstacionPropia
from app.models.reserva_model import Reservas
from app.models.estado_estacion_model import EstadoEstacion
from app.models.utils import ahora_utc
from app.utils.constantes import ESTADO_RESERVA_EN_CURSO

# Tope de estaciones por consulta en lote (el mapa pide las que están a la vista).
MAXIMO_ESTACIONES_LOTE = 120


def _nombre_completo(usuario) -> str:
    if not usuario:
        return "Usuario eliminado"
    if usuario.apellido and usuario.apellido.strip():
        return f"{usuario.nombre} {usuario.apellido}"
    return usuario.nombre


def obtener_estado_estacion(db: Session, estacion_id: str):
    estado_ocm = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == estacion_id).first()
    if estado_ocm and estado_ocm.estado in {"mantenimiento", "inactiva"}:
        return {"estado": estado_ocm.estado}

    propia = db.query(EstacionPropia).filter(EstacionPropia.id == estacion_id).first()
    if propia and propia.estado == "mantenimiento":
        return {"estado": "mantenimiento"}
    if propia and propia.estado == "inactiva":
        return {"estado": "inactiva"}

    ahora = ahora_utc()
    reservas = db.query(Reservas).options(joinedload(Reservas.usuario)).filter(
        Reservas.estacion_ocm_id == estacion_id,
        Reservas.estado.in_(("aprobada", "activa", ESTADO_RESERVA_EN_CURSO)),
        Reservas.fecha_hora_fin >= ahora,
    ).all()
    if reservas:
        return {
            "estado": "disponible",
            "cargadores_reservados": [r.cargador_id for r in reservas if r.cargador_id],
            # Cargadores donde alguien ya escaneó el QR y está cargando ahora mismo.
            "cargadores_en_uso": [r.cargador_id for r in reservas if r.cargador_id and r.estado == ESTADO_RESERVA_EN_CURSO],
            "reservas_por_cargador": [
                {"cargador_id": r.cargador_id, "reservado_por": r.reservante_nombre or "Usuario EV Charge"}
                for r in reservas if r.cargador_id
            ],
        }

    return {"estado": "disponible"}



def obtener_estados_lote(db: Session, ids: list[str]) -> dict:
    """Estado de varias estaciones en una sola petición, para refrescar el mapa seguido."""
    unicos = list(dict.fromkeys(str(i) for i in ids if i))[:MAXIMO_ESTACIONES_LOTE]
    return {eid: obtener_estado_estacion(db, eid) for eid in unicos}
