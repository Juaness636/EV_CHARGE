# Backend/controllers/empresa_incidentes_controller.py
"""Incidentes y atención de reportes de la empresa (Fase 5).

Atender un reporte y cambiar el estado de una estación no se copia de `admin_controller`:
se llama a `aplicar_estado_reporte` y a `cambiar_estado`, así admin y empresa comparten
una sola implementación de cada regla.
"""

from fastapi import Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.config.database import get_db
from app.controllers.empresa_controller import get_current_user_empresa
from app.controllers.empresa_estaciones_controller import (
    ids_estaciones_empresa,
    obtener_estacion_de_empresa,
)
from app.controllers.estacion_estado_controller import cambiar_estado
from app.controllers.historial_controller import registrar_historial
from app.controllers.notificaciones_controller import crear_notificacion
from app.controllers.reportes_controller import aplicar_estado_reporte
from app.models.cargador_model import Cargador
from app.models.estacion_propia_model import EstacionPropia
from app.models.incidente_model import Incidente
from app.models.reporte_model import Reportes
from app.models.utils import ahora_utc
from app.schemas.incidente_schema import IncidenteCreate, IncidenteEstadoUpdate
from app.utils.constantes import (
    ACCION_HISTORIAL_ABRIR_INCIDENTE,
    ACCION_HISTORIAL_CERRAR_INCIDENTE,
    ESTADO_ESTACION_MANTENIMIENTO,
    ESTADO_INCIDENTE_ABIERTO,
    ESTADO_INCIDENTE_CERRADO,
    ESTADO_INCIDENTE_RESUELTO,
    ESTADO_REPORTE_ABIERTO,
    ESTADOS_REPORTE,
    INCIDENTES_NO_CERRADOS,
    TRANSICIONES_INCIDENTE,
)

INCIDENTE_ESTADOS_CERRANDO = (ESTADO_INCIDENTE_RESUELTO, ESTADO_INCIDENTE_CERRADO)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _incidente_de_empresa(db: Session, ctx: dict, incidente_id: str) -> Incidente:
    incidente = (
        db.query(Incidente)
        .options(joinedload(Incidente.estacion), joinedload(Incidente.cargador))
        .filter(Incidente.id == incidente_id, Incidente.empresa_id == ctx["empresa_id"])
        .first()
    )
    if not incidente:
        raise HTTPException(status_code=404, detail="Incidente no encontrado.")
    return incidente


def _reporte_de_empresa(db: Session, ctx: dict, reporte_id: str) -> Reportes:
    ids = ids_estaciones_empresa(db, ctx["empresa_id"])
    reporte = (
        db.query(Reportes)
        .filter(Reportes.id == reporte_id, Reportes.estacion_ocm_id.in_(ids))
        .first()
    )
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado.")
    return reporte


def _quedan_bloqueantes_abiertos(db: Session, estacion_id: str) -> bool:
    return (
        db.query(func.count(Incidente.id))
        .filter(
            Incidente.estacion_id == estacion_id,
            Incidente.bloquea_estacion.is_(True),
            Incidente.estado.in_(INCIDENTES_NO_CERRADOS),
        )
        .scalar()
        or 0
    ) > 0


def _incidente_a_dict(incidente: Incidente, puede_reactivar: bool = False) -> dict:
    return {
        "id": incidente.id,
        "estacion_id": incidente.estacion_id,
        "estacion_nombre": incidente.estacion.nombre if incidente.estacion else "",
        "cargador_id": incidente.cargador_id,
        "cargador_numero": incidente.cargador.numero if incidente.cargador else None,
        "reporte_id": incidente.reporte_id,
        "tipo": incidente.tipo,
        "titulo": incidente.titulo,
        "descripcion": incidente.descripcion or "",
        "prioridad": incidente.prioridad,
        "bloquea_estacion": bool(incidente.bloquea_estacion),
        "estado": incidente.estado,
        "fecha_inicio": incidente.fecha_inicio,
        "fecha_fin": incidente.fecha_fin,
        "solucion": incidente.solucion,
        "puede_reactivar": puede_reactivar,
    }


def _historial_incidente(
    db: Session,
    ctx: dict,
    estacion: EstacionPropia,
    accion: str,
    motivo: str,
    detalle: dict,
):
    registrar_historial(
        db,
        empresa_id=ctx["empresa_id"],
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=accion,
        motivo=motivo,
        detalle=detalle,
    )


# ---------------------------------------------------------------------------
# Reportes de usuarios sobre estaciones de la empresa
# ---------------------------------------------------------------------------

def listar_reportes_empresa(
    estado: str | None = None,
    estacion_id: str | None = None,
    page: int = 1,
    limit: int = 20,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    ids = ids_estaciones_empresa(db, ctx["empresa_id"])
    if not ids:
        return {"total": 0, "page": page, "limit": limit, "resultados": []}

    if estado and estado not in ESTADOS_REPORTE:
        raise HTTPException(status_code=400, detail="Estado de reporte no válido.")

    consulta = db.query(Reportes).filter(Reportes.estacion_ocm_id.in_(ids))
    if estado:
        consulta = consulta.filter(Reportes.estado == estado)
    if estacion_id:
        # Se filtra dentro del conjunto ya restringido a la empresa (D3).
        consulta = consulta.filter(Reportes.estacion_ocm_id == estacion_id)

    limit = max(1, min(limit, 100))
    page = max(1, page)
    total = consulta.count()
    reportes = (
        consulta.options(joinedload(Reportes.usuario))
        .order_by(Reportes.fecha.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    nombres = {
        eid: nombre
        for eid, nombre in db.query(EstacionPropia.id, EstacionPropia.nombre)
        .filter(EstacionPropia.id.in_(ids))
        .all()
    }
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "resultados": [
            {
                "id": r.id,
                "estacion_ocm_id": r.estacion_ocm_id,
                "estacion_nombre": nombres.get(r.estacion_ocm_id, r.estacion_nombre or ""),
                "tipo": r.tipo,
                "descripcion": r.descripcion or "",
                "estado": r.estado,
                "fecha": r.fecha,
                # Privacidad: se muestra el nombre, nunca el correo del usuario.
                "usuario_nombre": (
                    f"{r.usuario.nombre} {r.usuario.apellido or ''}".strip()
                    if r.usuario
                    else "Usuario eliminado"
                ),
            }
            for r in reportes
        ],
    }


def cambiar_estado_reporte_empresa(
    reporte_id: str,
    estado: str,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    """La empresa atiende un reporte de su estación; la lógica es la del admin."""
    reporte = _reporte_de_empresa(db, ctx, reporte_id)
    aplicar_estado_reporte(db, reporte, estado)
    db.commit()
    db.refresh(reporte)
    return {"id": reporte.id, "estado": reporte.estado}


def reporte_a_incidente(
    reporte_id: str,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    """Atajo: el reporte de un usuario se convierte en incidente de la empresa.

    El reporte sigue `abierto` hasta que la empresa lo resuelva o descarte; el
    vínculo queda en `incidentes.reporte_id`.
    """
    empresa = ctx["empresa"]
    reporte = _reporte_de_empresa(db, ctx, reporte_id)
    estacion = obtener_estacion_de_empresa(db, empresa.id, reporte.estacion_ocm_id)

    if reporte.estado != ESTADO_REPORTE_ABIERTO:
        raise HTTPException(
            status_code=409, detail="Solo se puede abrir un incidente desde un reporte abierto."
        )

    incidente = Incidente(
        estacion_id=estacion.id,
        reporte_id=reporte.id,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        tipo="falla",
        titulo=(reporte.descripcion or f"Reporte de usuario en {estacion.nombre}")[:150],
        descripcion=reporte.descripcion or "",
        prioridad="media",
        bloquea_estacion=False,
        estado=ESTADO_INCIDENTE_ABIERTO,
    )
    db.add(incidente)
    db.flush()

    crear_notificacion(
        db,
        reporte.usuario_id,
        "Reporte en atención",
        f"{empresa.nombre_comercial} abrió un incidente a partir de tu reporte en {estacion.nombre}.",
        "reporte",
    )
    _historial_incidente(
        db,
        ctx,
        estacion,
        ACCION_HISTORIAL_ABRIR_INCIDENTE,
        incidente.titulo,
        {"reporte_id": reporte.id, "incidente_id": incidente.id, "origen": "reporte"},
    )
    db.commit()
    db.refresh(incidente)
    return _incidente_a_dict(incidente)


# ---------------------------------------------------------------------------
# Incidentes
# ---------------------------------------------------------------------------

def listar_incidentes_empresa(
    estacion_id: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    page: int = 1,
    limit: int = 20,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    consulta = db.query(Incidente).filter(Incidente.empresa_id == ctx["empresa_id"])
    if estacion_id:
        consulta = consulta.filter(Incidente.estacion_id == estacion_id)
    if estado:
        consulta = consulta.filter(Incidente.estado == estado)
    if tipo:
        consulta = consulta.filter(Incidente.tipo == tipo)

    limit = max(1, min(limit, 100))
    page = max(1, page)
    total = consulta.count()
    incidentes = (
        consulta.options(joinedload(Incidente.estacion), joinedload(Incidente.cargador))
        .order_by(Incidente.fecha_inicio.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "resultados": [_incidente_a_dict(i) for i in incidentes],
    }


def detalle_incidente_empresa(
    incidente_id: str,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    return _incidente_a_dict(_incidente_de_empresa(db, ctx, incidente_id))


def crear_incidente_empresa(
    data: IncidenteCreate,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, data.estacion_id)

    if data.cargador_id:
        cargador = (
            db.query(Cargador)
            .filter(Cargador.id == data.cargador_id, Cargador.estacion_id == estacion.id)
            .first()
        )
        if not cargador:
            raise HTTPException(status_code=404, detail="Cargador no encontrado en esta estación.")

    incidente = Incidente(
        estacion_id=estacion.id,
        cargador_id=data.cargador_id,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        tipo=data.tipo,
        titulo=data.titulo.strip(),
        descripcion=data.descripcion or "",
        prioridad=data.prioridad,
        bloquea_estacion=data.bloquea_estacion,
        estado=ESTADO_INCIDENTE_ABIERTO,
    )
    db.add(incidente)
    db.flush()

    # RN-E07: un incidente bloqueante pasa la estación a mantenimiento por la misma vía
    # del cambio de estado manual (historial + cancelación de reservas en un solo camino).
    if data.bloquea_estacion and estacion.estado != ESTADO_ESTACION_MANTENIMIENTO:
        cambiar_estado(
            db,
            estacion,
            ESTADO_ESTACION_MANTENIMIENTO,
            f"Incidente bloqueante: {incidente.titulo}",
            actor_id=ctx["usuario_id"],
            actor_nombre=ctx["usuario_nombre"],
            accion=ACCION_HISTORIAL_ABRIR_INCIDENTE,
            detalle_extra={"incidente_id": incidente.id, "origen": "incidente_bloqueante"},
        )
    else:
        _historial_incidente(
            db,
            ctx,
            estacion,
            ACCION_HISTORIAL_ABRIR_INCIDENTE,
            incidente.titulo,
            {"incidente_id": incidente.id, "bloquea_estacion": data.bloquea_estacion},
        )

    db.commit()
    db.refresh(incidente)
    return _incidente_a_dict(incidente)


def cambiar_estado_incidente_empresa(
    incidente_id: str,
    data: IncidenteEstadoUpdate,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
):
    """Máquina de estados (TRANSICIONES_INCIDENTE): se rechazan los saltos inválidos."""
    incidente = _incidente_de_empresa(db, ctx, incidente_id)
    permitidos = TRANSICIONES_INCIDENTE.get(incidente.estado, set())
    if data.estado not in permitidos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Transición no permitida: {incidente.estado} -> {data.estado}. "
                f"Estados válidos desde aquí: {', '.join(sorted(permitidos)) or 'ninguno'}."
            ),
        )

    anterior = incidente.estado
    incidente.estado = data.estado
    if data.solucion:
        incidente.solucion = data.solucion.strip()

    puede_reactivar = False
    if data.estado in INCIDENTE_ESTADOS_CERRANDO:
        incidente.fecha_fin = ahora_utc()
        if not incidente.solucion:
            incidente.solucion = "Incidente cerrado sin solución documentada."
        # RN-E07: se propone reactivar; la decisión final es de la empresa.
        # `SessionLocal` corre con autoflush=False: sin este flush el conteo vería
        # todavía el estado anterior del propio incidente y nunca propondría reactivar.
        db.flush()
        if incidente.bloquea_estacion and not _quedan_bloqueantes_abiertos(db, incidente.estacion_id):
            puede_reactivar = True

    _historial_incidente(
        db,
        ctx,
        incidente.estacion,
        ACCION_HISTORIAL_CERRAR_INCIDENTE
        if data.estado in INCIDENTE_ESTADOS_CERRANDO
        else ACCION_HISTORIAL_ABRIR_INCIDENTE,
        incidente.titulo,
        {"incidente_id": incidente.id, "estado_antes": anterior, "estado": incidente.estado},
    )
    db.commit()
    db.refresh(incidente)
    return _incidente_a_dict(incidente, puede_reactivar)
