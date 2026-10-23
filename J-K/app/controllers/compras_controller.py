from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.controllers.notificaciones_controller import crear_notificacion
from app.models.compra_model import Compras, MensajeCompra
from app.models.usuario_model import usuarios
from app.utils.content_filter import validar_contenido

ETIQUETAS_ESTADO_PEDIDO = {
    "pendiente": "pendiente de confirmación",
    "confirmado": "confirmado",
    "enviado": "enviado",
    "entregado": "entregado",
    "cancelado": "cancelado",
}


def _sin_leer(db: Session, compra_ids: list[str], escritos_por_admin: bool) -> dict[str, int]:
    """Mensajes que la otra parte aún no ha leído, agrupados por compra."""
    if not compra_ids:
        return {}
    filas = (
        db.query(MensajeCompra.compra_id, func.count(MensajeCompra.id))
        .filter(
            MensajeCompra.compra_id.in_(compra_ids),
            MensajeCompra.es_admin.is_(escritos_por_admin),
            MensajeCompra.leido.is_(False),
        )
        .group_by(MensajeCompra.compra_id)
        .all()
    )
    return dict(filas)


def _con_contador(compras: list[Compras], contador: dict[str, int]) -> list[Compras]:
    for compra in compras:
        compra.mensajes_sin_leer = contador.get(compra.id, 0)
    return compras


def _marcar_leidos(db: Session, compra: Compras, escritos_por_admin: bool):
    db.query(MensajeCompra).filter(
        MensajeCompra.compra_id == compra.id,
        MensajeCompra.es_admin.is_(escritos_por_admin),
        MensajeCompra.leido.is_(False),
    ).update({"leido": True}, synchronize_session=False)
    db.commit()
    db.refresh(compra)


def _agregar_mensaje(db: Session, compra: Compras, autor_id: str, texto: str, es_admin: bool) -> MensajeCompra:
    texto = (texto or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío.")
    validar_contenido(texto)
    mensaje = MensajeCompra(compra_id=compra.id, autor_id=autor_id, es_admin=es_admin, texto=texto)
    db.add(mensaje)
    return mensaje


# ---------- Comprador ----------

def listar_compras(db: Session, usuario_id: str):
    compras = (
        db.query(Compras)
        .filter(Compras.usuario_id == usuario_id)
        .order_by(Compras.created_at.desc())
        .all()
    )
    return _con_contador(compras, _sin_leer(db, [c.id for c in compras], escritos_por_admin=True))


def _compra_del_usuario(db: Session, compra_id: str, usuario_id: str) -> Compras:
    compra = db.query(Compras).filter(Compras.id == compra_id, Compras.usuario_id == usuario_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada.")
    return compra


def obtener_compra(db: Session, compra_id: str, usuario_id: str):
    compra = _compra_del_usuario(db, compra_id, usuario_id)
    _marcar_leidos(db, compra, escritos_por_admin=True)
    compra.mensajes_sin_leer = 0
    return compra


def enviar_mensaje_comprador(db: Session, compra_id: str, usuario, texto: str):
    compra = _compra_del_usuario(db, compra_id, usuario.id)
    if compra.estado_pedido in ("entregado", "cancelado"):
        raise HTTPException(status_code=400, detail="Este pedido ya está cerrado. Escríbenos desde Contacto si necesitas ayuda.")
    mensaje = _agregar_mensaje(db, compra, usuario.id, texto, es_admin=False)
    db.commit()
    db.refresh(mensaje)
    return mensaje


# ---------- Administrador ----------

def listar_compras_admin(db: Session, estado_pedido: str | None = None, busqueda: str | None = None):
    consulta = db.query(Compras).options(joinedload(Compras.usuario)).join(usuarios, usuarios.id == Compras.usuario_id)
    if estado_pedido:
        consulta = consulta.filter(Compras.estado_pedido == estado_pedido)
    if busqueda and busqueda.strip():
        patron = f"%{busqueda.strip()}%"
        consulta = consulta.filter(or_(
            Compras.producto.ilike(patron),
            Compras.transaccion_id.ilike(patron),
            Compras.ciudad.ilike(patron),
            Compras.contacto_nombre.ilike(patron),
            usuarios.nombre.ilike(patron),
            usuarios.apellido.ilike(patron),
            usuarios.email.ilike(patron),
        ))
    compras = consulta.order_by(Compras.created_at.desc()).limit(300).all()
    for compra in compras:
        compra.comprador = compra.usuario
    return _con_contador(compras, _sin_leer(db, [c.id for c in compras], escritos_por_admin=False))


def _compra_admin(db: Session, compra_id: str) -> Compras:
    compra = db.query(Compras).options(joinedload(Compras.usuario)).filter(Compras.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada.")
    return compra


def obtener_compra_admin(db: Session, compra_id: str):
    compra = _compra_admin(db, compra_id)
    _marcar_leidos(db, compra, escritos_por_admin=False)
    compra.comprador = compra.usuario
    compra.mensajes_sin_leer = 0
    return compra


def actualizar_estado_pedido(db: Session, compra_id: str, estado_pedido: str):
    compra = _compra_admin(db, compra_id)
    if compra.estado_pedido in ("entregado", "cancelado") and estado_pedido != compra.estado_pedido:
        raise HTTPException(status_code=400, detail="El pedido ya está cerrado y no puede cambiar de estado.")
    if estado_pedido != compra.estado_pedido:
        compra.estado_pedido = estado_pedido
        crear_notificacion(
            db,
            compra.usuario_id,
            "Actualización de tu pedido",
            f"Tu pedido de {compra.producto} ahora está {ETIQUETAS_ESTADO_PEDIDO[estado_pedido]}.",
            "compra",
        )
        db.commit()
    return obtener_compra_admin(db, compra_id)


def enviar_mensaje_admin(db: Session, compra_id: str, admin, texto: str):
    compra = _compra_admin(db, compra_id)
    mensaje = _agregar_mensaje(db, compra, admin.id, texto, es_admin=True)
    crear_notificacion(
        db,
        compra.usuario_id,
        "Nuevo mensaje sobre tu pedido",
        f"EV Charge te escribió sobre tu pedido de {compra.producto}. Revísalo en Mis compras.",
        "compra",
    )
    db.commit()
    db.refresh(mensaje)
    return mensaje


def resumen_pedidos_admin(db: Session) -> dict:
    por_estado = dict(db.query(Compras.estado_pedido, func.count(Compras.id)).group_by(Compras.estado_pedido).all())
    sin_leer = (
        db.query(func.count(MensajeCompra.id))
        .filter(MensajeCompra.es_admin.is_(False), MensajeCompra.leido.is_(False))
        .scalar()
    )
    return {"por_estado": por_estado, "mensajes_sin_leer": sin_leer or 0}
