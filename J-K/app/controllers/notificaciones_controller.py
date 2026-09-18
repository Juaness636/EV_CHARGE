from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.notificacion_model import Notificacion

RETENCION_NOTIFICACIONES_LEIDAS_DIAS = 30


def crear_notificacion(db: Session, usuario_id: str, titulo: str, mensaje: str, tipo: str):
    notificacion = Notificacion(
        usuario_id=usuario_id,
        titulo=titulo,
        mensaje=mensaje,
        tipo=tipo,
    )
    db.add(notificacion)
    return notificacion


def listar_notificaciones(db: Session, usuario_id: str):
    # La bandeja del usuario se limpia al consultarse: solo se eliminan
    # avisos ya leídos y con más de 30 días de antigüedad.
    fecha_limite = datetime.now(timezone.utc) - timedelta(days=RETENCION_NOTIFICACIONES_LEIDAS_DIAS)
    db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id,
        Notificacion.leida.is_(True),
        Notificacion.created_at < fecha_limite,
    ).delete(synchronize_session=False)
    db.commit()
    return (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id)
        .order_by(Notificacion.created_at.desc())
        .all()
    )


def listar_notificaciones_admin_global(db: Session):
    filas = (
        db.query(Notificacion)
        .order_by(Notificacion.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {"id": item.id, "titulo": item.titulo, "mensaje": item.mensaje, "tipo": item.tipo,
         "leida": item.admin_leida, "created_at": item.created_at}
        for item in filas
    ]


def marcar_notificaciones_leidas(db: Session, usuario_id: str):
    db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id,
        Notificacion.leida.is_(False),
    ).update({"leida": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}


def marcar_notificaciones_admin_leidas(db: Session):
    """Marca como vistas para el administrador sin modificar la bandeja de cada usuario."""
    db.query(Notificacion).filter(Notificacion.admin_leida.is_(False)).update(
        {"admin_leida": True}, synchronize_session=False
    )
    db.commit()
    return {"ok": True}


def eliminar_notificacion(db: Session, notificacion_id: str, usuario_id: str):
    notificacion = (
        db.query(Notificacion)
        .filter(Notificacion.id == notificacion_id, Notificacion.usuario_id == usuario_id)
        .first()
    )
    if notificacion is None:
        return False
    db.delete(notificacion)
    db.commit()
    return True
