from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.compras_controller import enviar_mensaje_comprador, listar_compras, obtener_compra
from app.schemas.compras_schema import CompraDetalleOut, CompraOut, MensajeCompraCrear, MensajeCompraOut
from app.utils.jwt import get_current_user

router = APIRouter(prefix="/compras", tags=["Compras"])


@router.get("", response_model=list[CompraOut])
def compras_listar(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return listar_compras(db, current_user.id)


@router.get("/{compra_id}", response_model=CompraDetalleOut)
def compras_detalle(compra_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return obtener_compra(db, compra_id, current_user.id)


@router.post("/{compra_id}/mensajes", response_model=MensajeCompraOut, status_code=201)
def compras_mensaje(compra_id: str, data: MensajeCompraCrear, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return enviar_mensaje_comprador(db, compra_id, current_user, data.texto)
