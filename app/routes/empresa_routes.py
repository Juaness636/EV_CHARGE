# Backend/routes/empresa_routes.py
"""Namespace /empresa: todo detrás de `require_empresa` (RN-E01).

Ninguna ruta recibe `empresa_id` en el cuerpo ni en la query: el contexto sale del token
(`get_current_user_empresa`), y el aislamiento real lo hacen los controllers al filtrar
por él. El frontend puede esconder botones, pero la barrera es aquí.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import (
    empresa_estadisticas_controller,
    empresa_estaciones_controller,
    empresa_incidentes_controller,
    empresa_reporte_controller,
)
from app.controllers.empresa_controller import (
    actualizar_perfil_empresa,
    cambiar_password_por_empresa,
    get_current_user_empresa,
    obtener_perfil_empresa,
)
from app.controllers.historial_controller import listar_historial
from app.schemas.auth_schemas import PasswordUpdate
from app.schemas.empresa_schema import CargadorCreate, CargadorUpdate, EmpresaUpdate
from app.schemas.estacion_empresa_schema import (
    EstacionEmpresaCreate,
    EstacionEmpresaUpdate,
    EstacionEstadoUpdate,
)
from app.schemas.incidente_schema import IncidenteCreate, IncidenteEstadoUpdate, ReporteEstadoUpdate
from app.utils.constantes import ACCIONES_HISTORIAL, ESTADOS_REPORTE

router = APIRouter(prefix="/empresa", tags=["Empresa"])


def _fecha(valor: str | None, nombre: str) -> datetime | None:
    """Fecha ISO (`2026-10-01`) o datetime completo; None significa "sin filtro"."""
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"El parámetro '{nombre}' debe ser una fecha ISO, ej: 2026-10-01.",
        ) from None


# ---------------------------------------------------------------------------
# Perfil
# ---------------------------------------------------------------------------

@router.get("/perfil")
def perfil_actual(ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return obtener_perfil_empresa(empresa=ctx["empresa"], db=db)


@router.put("/perfil")
def perfil_actualizar(
    data: EmpresaUpdate,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return actualizar_perfil_empresa(data, empresa=ctx["empresa"], db=db)


@router.post("/perfil/password")
def perfil_password(
    data: PasswordUpdate,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return cambiar_password_por_empresa(
        old_password=data.old_password,
        new_password=data.new_password,
        empresa=ctx["empresa"],
        db=db,
    )


# ---------------------------------------------------------------------------
# Estaciones y cargadores
# ---------------------------------------------------------------------------

@router.get("/estaciones")
def estaciones_listar(ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return empresa_estaciones_controller.listar_estaciones_empresa(ctx, db)


@router.post("/estaciones")
def estaciones_crear(
    data: EstacionEmpresaCreate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.crear_estacion_empresa(data, ctx, db)


@router.get("/estaciones/{estacion_id}")
def estaciones_detalle(
    estacion_id: str,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.detalle_estacion_empresa(estacion_id, ctx, db)


@router.put("/estaciones/{estacion_id}")
def estaciones_actualizar(
    estacion_id: str,
    data: EstacionEmpresaUpdate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.actualizar_estacion_empresa(estacion_id, data, ctx, db)


@router.delete("/estaciones/{estacion_id}")
def estaciones_eliminar(
    estacion_id: str,
    motivo: str = Query(min_length=10, description="Motivo del borrado lógico (RN-E08)."),
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.eliminar_estacion_empresa(estacion_id, motivo, ctx, db)


@router.patch("/estaciones/{estacion_id}/estado")
def estaciones_estado(
    estacion_id: str,
    data: EstacionEstadoUpdate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.cambiar_estado_estacion_empresa(estacion_id, data, ctx, db)


@router.post("/estaciones/{estacion_id}/cargadores")
def cargadores_agregar(
    estacion_id: str,
    data: CargadorCreate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.agregar_cargador(estacion_id, data, ctx, db)


@router.put("/estaciones/{estacion_id}/cargadores/{cargador_id}")
def cargadores_actualizar(
    estacion_id: str,
    cargador_id: str,
    data: CargadorUpdate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.actualizar_cargador(estacion_id, cargador_id, data, ctx, db)


@router.delete("/estaciones/{estacion_id}/cargadores/{cargador_id}")
def cargadores_quitar(
    estacion_id: str,
    cargador_id: str,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_estaciones_controller.quitar_cargador(estacion_id, cargador_id, ctx, db)


# ---------------------------------------------------------------------------
# Historial (solo lectura: no existen PUT ni DELETE, y eso ES la regla RN-E05)
# ---------------------------------------------------------------------------

@router.get("/historial")
def historial_listar(
    estacion_id: str | None = None,
    accion: str | None = Query(default=None, description=f"Una de: {', '.join(ACCIONES_HISTORIAL)}"),
    desde: str | None = None,
    hasta: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    if accion and accion not in ACCIONES_HISTORIAL:
        raise HTTPException(status_code=400, detail="Acción de historial no válida.")
    return listar_historial(
        db,
        ctx["empresa_id"],
        estacion_id=estacion_id,
        accion=accion,
        desde=_fecha(desde, "desde"),
        hasta=_fecha(hasta, "hasta"),
        page=page,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Reportes de usuarios e incidentes
# ---------------------------------------------------------------------------

@router.get("/reportes")
def reportes_listar(
    estado: str | None = Query(default=None, description=f"Una de: {', '.join(ESTADOS_REPORTE)}"),
    estacion_id: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_incidentes_controller.listar_reportes_empresa(
        estado=estado, estacion_id=estacion_id, page=page, limit=limit, ctx=ctx, db=db
    )


@router.patch("/reportes/{reporte_id}/estado")
def reporte_estado(
    reporte_id: str,
    data: ReporteEstadoUpdate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_incidentes_controller.cambiar_estado_reporte_empresa(reporte_id, data.estado, ctx, db)


@router.post("/reportes/{reporte_id}/incidente")
def reporte_a_incidente(
    reporte_id: str,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_incidentes_controller.reporte_a_incidente(reporte_id, ctx, db)


@router.get("/incidentes")
def incidentes_listar(
    estacion_id: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_incidentes_controller.listar_incidentes_empresa(
        estacion_id=estacion_id, estado=estado, tipo=tipo, page=page, limit=limit, ctx=ctx, db=db
    )


@router.post("/incidentes")
def incidentes_crear(
    data: IncidenteCreate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_incidentes_controller.crear_incidente_empresa(data, ctx, db)


@router.get("/incidentes/{incidente_id}")
def incidentes_detalle(
    incidente_id: str,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_incidentes_controller.detalle_incidente_empresa(incidente_id, ctx, db)


@router.patch("/incidentes/{incidente_id}/estado")
def incidentes_estado(
    incidente_id: str,
    data: IncidenteEstadoUpdate,
    ctx: dict = Depends(empresa_estaciones_controller.operar),
    db: Session = Depends(get_db),
):
    return empresa_incidentes_controller.cambiar_estado_incidente_empresa(incidente_id, data, ctx, db)


# ---------------------------------------------------------------------------
# Estadísticas, panel y reporte mensual
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def dashboard(ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return empresa_estadisticas_controller.dashboard_empresa(ctx, db)


@router.get("/estadisticas/resumen")
def estadisticas_resumen(
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_estadisticas_controller.resumen_empresa(
        desde=_fecha(desde, "desde"), hasta=_fecha(hasta, "hasta"), ctx=ctx, db=db
    )


@router.get("/estadisticas/estaciones")
def estadisticas_estaciones(
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_estadisticas_controller.estadisticas_por_estacion(
        desde=_fecha(desde, "desde"), hasta=_fecha(hasta, "hasta"), ctx=ctx, db=db
    )


@router.get("/estadisticas/cargadores")
def estadisticas_cargadores(
    estacion_id: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_estadisticas_controller.estadisticas_por_cargador(
        estacion_id=estacion_id,
        desde=_fecha(desde, "desde"),
        hasta=_fecha(hasta, "hasta"),
        ctx=ctx,
        db=db,
    )


@router.get("/estadisticas/serie")
def estadisticas_serie(
    granularidad: str = Query(default="dia", pattern="^(dia|mes)$"),
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_estadisticas_controller.serie_temporal(
        desde=_fecha(desde, "desde"),
        hasta=_fecha(hasta, "hasta"),
        granularidad=granularidad,
        ctx=ctx,
        db=db,
    )


@router.get("/resenas")
def resenas_listar(
    estacion_id: str | None = None,
    puntaje: int | None = Query(default=None, ge=1, le=5),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return empresa_estadisticas_controller.resenas_empresa(
        estacion_id=estacion_id, puntaje=puntaje, page=page, limit=limit, ctx=ctx, db=db
    )


@router.get("/reporte-mensual")
def reporte_mensual(
    mes: str = Query(description="AAAA-MM, ej: 2026-10"),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    """Documento HTML imprimible (Fase 7): se descarga o se abre e imprime como PDF."""
    html = empresa_reporte_controller.generar_reporte_mensual(mes, ctx, db)
    nombre = ctx["empresa"].nombre_comercial.lower().replace(" ", "-")
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="reporte-{nombre}-{mes}.html"'},
    )
