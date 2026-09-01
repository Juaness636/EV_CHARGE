from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.notificaciones_controller import listar_notificaciones, marcar_notificaciones_leidas
from app.schemas.notificaciones_schema import NotificacionOut
from app.utils.jwt import get_current_user

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


@router.get("", response_model=list[NotificacionOut])
def notificaciones_listar(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return listar_notificaciones(db, current_user.id)


@router.patch("/leidas")
def notificaciones_leer(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return marcar_notificaciones_leidas(db, current_user.id)