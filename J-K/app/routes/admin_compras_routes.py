# Gestión de pedidos de productos desde el panel de administración.
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import compras_controller as ctrl
from app.schemas.compras_schema import (
    AdminCompraDetalleOut,
    AdminCompraOut,
    AdminCompraUpdate,
    EstadoPedido,
    MensajeCompraCrear,
    MensajeCompraOut,
)
from app.utils.jwt import require_admin

router = APIRouter(prefix="/admin/compras", tags=["Admin · Compras"])


@router.get("", response_model=list[AdminCompraOut])
def admin_compras(
    estado_pedido: EstadoPedido | None = Query(default=None),
    busqueda: str | None = Query(default=None, max_length=100),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ctrl.listar_compras_admin(db, estado_pedido, busqueda)


@router.get("/resumen")
def admin_compras_resumen(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.resumen_pedidos_admin(db)


@router.get("/{compra_id}", response_model=AdminCompraDetalleOut)
def admin_compra_detalle(compra_id: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.obtener_compra_admin(db, compra_id)


@router.patch("/{compra_id}/estado", response_model=AdminCompraDetalleOut)
def admin_compra_estado(compra_id: str, data: AdminCompraUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.actualizar_estado_pedido(db, compra_id, data.estado_pedido)


@router.post("/{compra_id}/mensajes", response_model=MensajeCompraOut, status_code=201)
def admin_compra_mensaje(compra_id: str, data: MensajeCompraCrear, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.enviar_mensaje_admin(db, compra_id, admin, data.texto)
