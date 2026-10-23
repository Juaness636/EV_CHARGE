# Backend/routes/admin_routes.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.utils.jwt import require_admin
from app.controllers import admin_controller as ctrl
from app.controllers.empresa_controller import (
    actualizar_palabras_empresa,
    cambiar_estado_empresa,
    crear_empresa,
    listar_empresas_admin,
    obtener_empresa_admin,
)
from app.schemas.auth_schemas import UsuarioOut
from app.schemas.empresa_schema import EmpresaCrear, EmpresaEstadoUpdate, EmpresaOut, EmpresaPalabrasUpdate
from app.schemas.admin_schema import (
    AdminEstadisticas,
    EstacionPropiaCreate,
    EstacionPropiaUpdate,
    EstadoUpdate,
    AdminReservaUpdate,
    AdminReservaDetail,
    AdminReporteEstado,
    AdminEstacionOcmUpdate,
    AdminCargaUpdate,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/usuarios", response_model=list[UsuarioOut])
def admin_usuarios(
    busqueda: str | None = Query(default=None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ctrl.listar_usuarios(db, busqueda)


@router.put("/usuarios/{uid}", response_model=UsuarioOut)
def admin_actualizar_usuario(uid: str, data: dict, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.actualizar_usuario(uid, data, db)


@router.get("/estadisticas", response_model=AdminEstadisticas)
def admin_estadisticas(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.obtener_estadisticas(db)


@router.get("/reportes")
def admin_reportes(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_reportes(db)


@router.patch("/reportes/{rid}/resolver")
def admin_resolver_reporte(rid: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.resolver_reporte(rid, db)


@router.patch("/reportes/{rid}/estado")
def admin_estado_reporte(rid: str, data: AdminReporteEstado, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.cambiar_estado_reporte(rid, data.estado, db)


@router.get("/estaciones")
def admin_estaciones(
    busqueda: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ctrl.listar_estaciones(db, busqueda, estado)


@router.post("/estaciones")
def admin_crear_estacion(data: EstacionPropiaCreate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.crear_estacion(data, db)


@router.put("/estaciones/{eid}")
def admin_actualizar_estacion(eid: str, data: EstacionPropiaUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.actualizar_estacion(eid, data, db)


@router.patch("/estaciones/{eid}/estado")
def admin_estado_estacion(eid: str, data: EstadoUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.cambiar_estado_estacion(eid, data, db, admin)


@router.patch("/estaciones-ocm/{eid}/estado")
def admin_estado_estacion_ocm(eid: str, data: EstadoUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.cambiar_estado_estacion_ocm(eid, data, db)


@router.get("/estaciones-ocm")
def admin_estaciones_ocm(
    busqueda: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return ctrl.listar_estaciones_ocm_admin(db, busqueda, estado)


@router.put("/estaciones-ocm/{eid}")
def admin_actualizar_estacion_ocm(eid: str, data: AdminEstacionOcmUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.actualizar_estacion_ocm(eid, data, db)


@router.delete("/estaciones-ocm/{eid}")
def admin_eliminar_estacion_ocm(eid: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.eliminar_estacion_ocm(eid, db)


@router.delete("/estaciones/{eid}")
def admin_eliminar_estacion(eid: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.eliminar_estacion(eid, db)


@router.get("/reservas", response_model=list[AdminReservaDetail])
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


@router.get("/cargas")
def admin_cargas(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_cargas_admin(db)


@router.get("/notificaciones")
def admin_notificaciones(admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.listar_notificaciones_admin(db)


@router.patch("/cargas/{cid}/estado")
def admin_estado_carga(cid: str, data: AdminCargaUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return ctrl.actualizar_carga_admin(cid, data.estado, db)


# ---------------------------------------------------------------------------
# Empresas: el admin crea la cuenta y la aprueba o suspende
# ---------------------------------------------------------------------------

@router.get("/empresas", response_model=list[EmpresaOut])
def admin_empresas(
    busqueda: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return listar_empresas_admin(db, busqueda, estado)


@router.post("/empresas", response_model=EmpresaOut)
def admin_empresas_crear(data: EmpresaCrear, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return crear_empresa(data, db)


@router.get("/empresas/{eid}", response_model=EmpresaOut)
def admin_empresa_detalle(eid: str, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return obtener_empresa_admin(eid, db)


@router.patch("/empresas/{eid}/estado", response_model=EmpresaOut)
def admin_empresa_estado(eid: str, data: EmpresaEstadoUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return cambiar_estado_empresa(eid, data, db)


@router.patch("/empresas/{eid}/palabras-clave", response_model=EmpresaOut)
def admin_empresa_palabras(eid: str, data: EmpresaPalabrasUpdate, admin=Depends(require_admin), db: Session = Depends(get_db)):
    return actualizar_palabras_empresa(eid, data, db)
