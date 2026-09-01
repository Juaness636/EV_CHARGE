from sqlalchemy.orm import Session

from app.models.notificacion_model import Notificacion


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
    return (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == usuario_id)
        .order_by(Notificacion.created_at.desc())
        .all()
    )


def marcar_notificaciones_leidas(db: Session, usuario_id: str):
    db.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id,
        Notificacion.leida.is_(False),
    ).update({"leida": True}, synchronize_session=False)
    db.commit()
    return {"ok": True}