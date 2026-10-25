# Backend/routes/reservas_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.utils.jwt import get_current_user
from app.controllers.reservas_controller import (
    listar_mis_reservas,
    crear_reserva,
    crear_reserva_confirmada,
    actualizar_reserva,
    cancelar_reserva,
    eliminar_reserva,
)
from app.controllers.carga_qr_controller import escanear_qr, terminar_carga
from app.schemas.reservas_schemas import ReservaCreate, ReservaConfirmadaCreate, ReservaUpdate, ReservaCotizacion, EscaneoQR
from app.services.tarifas_service import calcular_precio_reserva, cotizar_reserva_servidor

# Sin prefix único: el contrato del frontend mezcla /mis-reservas, /reservar y /reservas/{rid}
router = APIRouter(tags=["Reservas"])


@router.post("/reservas/cotizar")
def cotizar_reserva(data: ReservaCotizacion, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if data.estacion_ocm_id:
        return cotizar_reserva_servidor(db, data.estacion_ocm_id, data.cargador_id, data.duracion_horas)
    return calcular_precio_reserva(
        data.estacion_nombre,
        data.operador,
        data.tipo_cargador,
        data.potencia_kw,
        data.duracion_horas,
    )


@router.get("/mis-reservas")
def mis_reservas(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return listar_mis_reservas(db, current_user.id)


@router.post("/reservar")
def reservar(data: ReservaCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return crear_reserva(db, current_user.id, data)


@router.post("/reservar-confirmada")
def reservar_confirmada(data: ReservaConfirmadaCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Crea una reserva activa únicamente después de un pago aprobado."""
    return crear_reserva_confirmada(db, current_user.id, data)


@router.put("/reservas/{rid}")
def reserva_actualizar(rid: str, data: ReservaUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return actualizar_reserva(db, current_user.id, rid, data)


@router.patch("/reservas/{rid}/cancelar")
def reserva_cancelar(rid: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return cancelar_reserva(db, current_user.id, rid)


@router.delete("/reservas/{rid}")
def reserva_eliminar(rid: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return eliminar_reserva(db, current_user.id, rid)


@router.post("/reservas/{rid}/escanear")
def reserva_escanear(rid: str, data: EscaneoQR, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Inicia la carga si el QR (o su código manual) es del cargador reservado y está en su franja."""
    return escanear_qr(db, current_user.id, rid, data.codigo)


@router.post("/reservas/{rid}/terminar")
def reserva_terminar(rid: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return terminar_carga(db, current_user.id, rid)
