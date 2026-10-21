# Backend/routes/cargas_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.utils.jwt import get_current_user
from app.controllers.cargas_controller import (
    listar_cargas,
    estadisticas_cargas,
    crear_carga,
    iniciar_carga,
    finalizar_carga,
    cancelar_carga_en_curso,
)
from app.schemas.cargas_schema import CargaCreate, CargaFinalizar, CargaIniciar

router = APIRouter(prefix="/cargas", tags=["Cargas"])


@router.get("/estadisticas")
def cargas_estadisticas(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return estadisticas_cargas(db, current_user.id)


@router.get("")
def cargas_listar(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return listar_cargas(db, current_user.id)


@router.post("")
def cargas_crear(data: CargaCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return crear_carga(db, current_user.id, data)


@router.post("/iniciar")
def cargas_iniciar(data: CargaIniciar, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return iniciar_carga(db, current_user.id, data)


@router.post("/{carga_id}/finalizar")
def cargas_finalizar(
    carga_id: str,
    data: CargaFinalizar,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return finalizar_carga(db, current_user.id, carga_id, data)


@router.delete("/{carga_id}")
def cargas_cancelar(carga_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return cancelar_carga_en_curso(db, current_user.id, carga_id)
