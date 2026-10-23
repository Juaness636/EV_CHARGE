# Backend/controllers/historial_controller.py
"""Bitácora del módulo de empresas (RN-E05).

`registrar_historial` hace `db.add` y NO commitea, igual que `crear_notificacion`:
el commit lo hace la función que llama, así el cambio y su registro son atómicos.
No existen rutas de edición ni borrado: que no exista la vía es la regla.
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.historial_estacion_model import HistorialEstacion


def registrar_historial(
    db: Session,
    *,
    empresa_id: Optional[str],
    usuario_id: str | None,
    usuario_nombre: str,
    estacion,
    accion: str,
    motivo: str = "",
    detalle: dict | None = None,
) -> Optional[HistorialEstacion]:
    # La bitácora es el registro de una empresa. Las estaciones de EV Charge
    # (empresa_id NULL) no tienen a qué bitácora pertenecer, así que se omite.
    if not empresa_id:
        return None
    registro = HistorialEstacion(
        estacion_id=estacion.id,
        # Snapshot: "el lugar" debe sobrevivir aunque la estación cambie de nombre.
        estacion_nombre=estacion.nombre,
        direccion=estacion.direccion or "",
        empresa_id=empresa_id,
        usuario_id=usuario_id,
        usuario_nombre=usuario_nombre or "",
        accion=accion,
        motivo=motivo or "",
        detalle=detalle,
    )
    db.add(registro)
    return registro


def listar_historial(
    db: Session,
    empresa_id: str,
    *,
    estacion_id: str | None = None,
    accion: str | None = None,
    desde=None,
    hasta=None,
    page: int = 1,
    limit: int = 20,
):
    consulta = db.query(HistorialEstacion).filter(HistorialEstacion.empresa_id == empresa_id)
    if estacion_id:
        consulta = consulta.filter(HistorialEstacion.estacion_id == estacion_id)
    if accion:
        consulta = consulta.filter(HistorialEstacion.accion == accion)
    if desde:
        consulta = consulta.filter(HistorialEstacion.fecha >= desde)
    if hasta:
        consulta = consulta.filter(HistorialEstacion.fecha <= hasta)

    total = consulta.count()
    limit = max(1, min(limit, 100))
    page = max(1, page)
    registros = (
        consulta.order_by(HistorialEstacion.fecha.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "resultados": [
            {
                "id": r.id,
                "estacion_id": r.estacion_id,
                "estacion_nombre": r.estacion_nombre,
                "direccion": r.direccion,
                "accion": r.accion,
                "motivo": r.motivo,
                "usuario_nombre": r.usuario_nombre,
                "detalle": r.detalle,
                "fecha": r.fecha,
            }
            for r in registros
        ],
    }
