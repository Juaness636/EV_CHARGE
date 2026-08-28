# Backend/routes/admin_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.utils.jwt import require_admin
from app.controllers import admin_controller as ctrl
from app.schemas.admin_schema import (
    AdminEstadisticas,
    EstacionPropiaCreate,
    EstadoUpdate,
    AdminReservaUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/usuarios")
def admin_usuarios(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_usuarios(db)


@router.get("/estadisticas", response_model=AdminEstadisticas)
def admin_estadisticas(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.obtener_estadisticas(db)


@router.get("/reportes")
def admin_reportes(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_reportes(db)


@router.patch("/reportes/{rid}/resolver")
def admin_resolver_reporte(rid: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.resolver_reporte(rid, db)


@router.get("/estaciones")
def admin_estaciones(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_estaciones(db)


@router.post("/estaciones")
def admin_crear_estacion(data: EstacionPropiaCreate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.crear_estacion(data, db)


@router.patch("/estaciones/{eid}/estado")
def admin_estado_estacion(eid: str, data: EstadoUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.cambiar_estado_estacion(eid, data, db)


@router.delete("/estaciones/{eid}")
def admin_eliminar_estacion(eid: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.eliminar_estacion(eid, db)


@router.get("/reservas")
def admin_reservas(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_reservas(db)


@router.put("/reservas/{rid}")
def admin_actualizar_reserva(rid: str, data: AdminReservaUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.actualizar_reserva(rid, data, db)


@router.delete("/reservas/{rid}")
def admin_eliminar_reserva(rid: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.eliminar_reserva(rid, db)


@router.get("/calificaciones")
def admin_calificaciones(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_calificaciones(db)