# Backend/routes/empresa_routes.py
"""Namespace /empresa: todo detrás del rol `empresa` (RN-E01).

Ninguna ruta recibe `empresa_id` en el cuerpo ni en la query: el contexto sale del token
(`get_current_user_empresa`) y los controllers filtran siempre por él. Las rutas de
escritura dependen de `operar`, que además exige la empresa aprobada (RN-E11).
Todas declaran `response_model`, así ninguna respuesta puede filtrar campos internos.
"""

import re
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers import (
    empresa_estadisticas_controller as estadisticas,
    empresa_estaciones_api_controller as estaciones_api,
    empresa_estaciones_controller as estaciones,
    empresa_fotos_controller as fotos,
    empresa_incidentes_controller as incidentes,
    empresa_reporte_controller as reporte,
)
from app.controllers.empresa_controller import (
    actualizar_perfil_empresa,
    cambiar_password_por_empresa,
    get_current_user_empresa,
    obtener_perfil_empresa,
    operar,
)
from app.controllers.historial_controller import listar_historial
from app.schemas.admin_schema import EstadoUpdate as AdminEstadoUpdate
from app.schemas.auth_schemas import PasswordUpdate
from app.schemas.empresa_estadisticas_schema import (
    DashboardEmpresaOut,
    EstadisticaEstacionOut,
    EstadisticasCargadoresOut,
    ResenasEmpresaOut,
    ResumenEmpresaOut,
    SerieTemporalOut,
)
from app.schemas.empresa_schema import CargadorCreate, CargadorUpdate, EmpresaOut, EmpresaUpdate
from app.schemas.estacion_empresa_schema import (
    EliminacionOut,
    EstacionEmpresaCreate,
    EstacionEmpresaOut,
    EstacionEmpresaUpdate,
    EstacionEstadoUpdate,
    HistorialPagina,
)
from app.schemas.incidente_schema import (
    IncidenteCreate,
    IncidenteEstadoUpdate,
    IncidenteOut,
    IncidentesPagina,
    ReporteEstadoOut,
    ReporteEstadoUpdate,
    ReportesPagina,
)
from app.utils.constantes import ACCIONES_HISTORIAL, LONGITUD_MINIMA_MOTIVO

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

@router.get("/perfil", response_model=EmpresaOut)
def perfil_actual(ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return obtener_perfil_empresa(ctx["empresa"], db)


@router.put("/perfil", response_model=EmpresaOut)
def perfil_actualizar(data: EmpresaUpdate, ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    # Editar los datos de contacto no publica nada: se permite aunque esté pendiente.
    return actualizar_perfil_empresa(data, ctx["empresa"], db)


@router.post("/perfil/password")
def perfil_password(data: PasswordUpdate, ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return cambiar_password_por_empresa(
        old_password=data.old_password,
        new_password=data.new_password,
        empresa=ctx["empresa"],
        db=db,
    )


# ---------------------------------------------------------------------------
# Estaciones y cargadores
# ---------------------------------------------------------------------------

@router.get("/estaciones", response_model=list[EstacionEmpresaOut])
def estaciones_listar(ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return estaciones.listar_estaciones_empresa(ctx, db)


# Estaciones de la API (OpenChargeMap) asignadas por palabras clave. Van antes de
# /estaciones/{estacion_id} para que "api" no se tome como un id.
@router.get("/estaciones/api")
def estaciones_api_listar(ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return estaciones_api.listar_estaciones_api_empresa(ctx, db)


@router.patch("/estaciones/api/{estacion_id}/estado")
def estaciones_api_estado(estacion_id: str, data: AdminEstadoUpdate, ctx: dict = Depends(operar), db: Session = Depends(get_db)):
    return estaciones_api.cambiar_estado_estacion_api_empresa(estacion_id, data, ctx, db)


@router.post("/estaciones", response_model=EstacionEmpresaOut)
def estaciones_crear(data: EstacionEmpresaCreate, ctx: dict = Depends(operar), db: Session = Depends(get_db)):
    return estaciones.crear_estacion_empresa(data, ctx, db)


@router.get("/estaciones/{estacion_id}", response_model=EstacionEmpresaOut)
def estaciones_detalle(estacion_id: str, ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return estaciones.detalle_estacion_empresa(estacion_id, ctx, db)


@router.put("/estaciones/{estacion_id}", response_model=EstacionEmpresaOut)
def estaciones_actualizar(
    estacion_id: str,
    data: EstacionEmpresaUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return estaciones.actualizar_estacion_empresa(estacion_id, data, ctx, db)


@router.delete("/estaciones/{estacion_id}", response_model=EliminacionOut)
def estaciones_eliminar(
    estacion_id: str,
    motivo: str = Query(min_length=LONGITUD_MINIMA_MOTIVO, max_length=500, description="Motivo del borrado lógico (RN-E08)."),
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return estaciones.eliminar_estacion_empresa(estacion_id, motivo, ctx, db)


@router.patch("/estaciones/{estacion_id}/estado", response_model=EstacionEmpresaOut)
def estaciones_estado(
    estacion_id: str,
    data: EstacionEstadoUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return estaciones.cambiar_estado_estacion_empresa(estacion_id, data, ctx, db)


@router.post("/estaciones/{estacion_id}/cargadores", response_model=EstacionEmpresaOut)
def cargadores_agregar(
    estacion_id: str,
    data: CargadorCreate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return estaciones.agregar_cargador(estacion_id, data, ctx, db)


@router.put("/estaciones/{estacion_id}/cargadores/{cargador_id}", response_model=EstacionEmpresaOut)
def cargadores_actualizar(
    estacion_id: str,
    cargador_id: str,
    data: CargadorUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return estaciones.actualizar_cargador(estacion_id, cargador_id, data, ctx, db)


@router.post("/estaciones/{estacion_id}/fotos", response_model=EstacionEmpresaOut)
async def fotos_subir(
    estacion_id: str,
    archivo: UploadFile = File(description="Foto JPG, PNG o WebP de máximo 5 MB."),
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return await fotos.subir_foto(estacion_id, archivo, ctx, db)


@router.delete("/estaciones/{estacion_id}/fotos/{foto_id}", response_model=EstacionEmpresaOut)
def fotos_eliminar(
    estacion_id: str,
    foto_id: str,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return fotos.eliminar_foto(estacion_id, foto_id, ctx, db)


@router.delete("/estaciones/{estacion_id}/cargadores/{cargador_id}", response_model=EstacionEmpresaOut)
def cargadores_quitar(
    estacion_id: str,
    cargador_id: str,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return estaciones.quitar_cargador(estacion_id, cargador_id, ctx, db)


# ---------------------------------------------------------------------------
# Historial (solo lectura: no existen PUT ni DELETE, y eso ES la regla RN-E05)
# ---------------------------------------------------------------------------

@router.get("/historial", response_model=HistorialPagina)
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

@router.get("/reportes", response_model=ReportesPagina)
def reportes_listar(
    estado: str | None = None,
    estacion_id: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return incidentes.listar_reportes_empresa(ctx, db, estado=estado, estacion_id=estacion_id, page=page, limit=limit)


@router.patch("/reportes/{reporte_id}/estado", response_model=ReporteEstadoOut)
def reporte_estado(
    reporte_id: str,
    data: ReporteEstadoUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return incidentes.cambiar_estado_reporte_empresa(reporte_id, data.estado, ctx, db)


@router.post("/reportes/{reporte_id}/incidente", response_model=IncidenteOut)
def reporte_a_incidente(reporte_id: str, ctx: dict = Depends(operar), db: Session = Depends(get_db)):
    return incidentes.reporte_a_incidente(reporte_id, ctx, db)


@router.get("/incidentes", response_model=IncidentesPagina)
def incidentes_listar(
    estacion_id: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return incidentes.listar_incidentes_empresa(
        ctx, db, estacion_id=estacion_id, estado=estado, tipo=tipo, page=page, limit=limit
    )


@router.post("/incidentes", response_model=IncidenteOut)
def incidentes_crear(data: IncidenteCreate, ctx: dict = Depends(operar), db: Session = Depends(get_db)):
    return incidentes.crear_incidente_empresa(data, ctx, db)


@router.get("/incidentes/{incidente_id}", response_model=IncidenteOut)
def incidentes_detalle(incidente_id: str, ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return incidentes.detalle_incidente_empresa(incidente_id, ctx, db)


@router.patch("/incidentes/{incidente_id}/estado", response_model=IncidenteOut)
def incidentes_estado(
    incidente_id: str,
    data: IncidenteEstadoUpdate,
    ctx: dict = Depends(operar),
    db: Session = Depends(get_db),
):
    return incidentes.cambiar_estado_incidente_empresa(incidente_id, data, ctx, db)


# ---------------------------------------------------------------------------
# Panel, estadísticas, reseñas y reporte mensual
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardEmpresaOut)
def dashboard(ctx: dict = Depends(get_current_user_empresa), db: Session = Depends(get_db)):
    return estadisticas.dashboard_empresa(ctx, db)


@router.get("/estadisticas/resumen", response_model=ResumenEmpresaOut)
def estadisticas_resumen(
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return estadisticas.resumen_empresa(ctx, db, desde=_fecha(desde, "desde"), hasta=_fecha(hasta, "hasta"))


@router.get("/estadisticas/estaciones", response_model=list[EstadisticaEstacionOut])
def estadisticas_estaciones(
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return estadisticas.estadisticas_por_estacion(ctx, db, desde=_fecha(desde, "desde"), hasta=_fecha(hasta, "hasta"))


@router.get("/estadisticas/cargadores", response_model=EstadisticasCargadoresOut)
def estadisticas_cargadores(
    estacion_id: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return estadisticas.estadisticas_por_cargador(
        ctx, db, estacion_id=estacion_id, desde=_fecha(desde, "desde"), hasta=_fecha(hasta, "hasta")
    )


@router.get("/estadisticas/serie", response_model=SerieTemporalOut)
def estadisticas_serie(
    granularidad: str = Query(default="dia", pattern="^(dia|mes)$"),
    desde: str | None = None,
    hasta: str | None = None,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return estadisticas.serie_temporal(
        ctx, db, desde=_fecha(desde, "desde"), hasta=_fecha(hasta, "hasta"), granularidad=granularidad
    )


@router.get("/resenas", response_model=ResenasEmpresaOut)
def resenas_listar(
    estacion_id: str | None = None,
    puntaje: int | None = Query(default=None, ge=1, le=5),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return estadisticas.resenas_empresa(ctx, db, estacion_id=estacion_id, puntaje=puntaje, page=page, limit=limit)


@router.get("/reporte-mensual")
def reporte_mensual(
    mes: str = Query(pattern=r"^\d{4}-\d{2}$", description="AAAA-MM, ej: 2026-10"),
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    """Documento HTML imprimible: se descarga, o se abre e imprime como PDF."""
    html = reporte.generar_reporte_mensual(mes, ctx, db)
    # Solo [a-z0-9-] en el nombre del archivo: el nombre comercial lo escribe la empresa.
    nombre = re.sub(r"[^a-z0-9]+", "-", ctx["empresa"].nombre_comercial.lower()).strip("-") or "empresa"
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="reporte-{nombre}-{mes}.html"'},
    )
