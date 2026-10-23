# Backend/controllers/empresa_estadisticas_controller.py
"""Estadísticas y panel de la empresa.

Convenciones:
- Los ids de estación se resuelven primero y se usan en `.in_()`.
- `func.coalesce` sobre las sumas: sin datos SQL devuelve NULL y eso rompería el JSON.
- El rango de fechas siempre está acotado: nunca "todas las cargas de todos los tiempos".
- Solo se cuentan cargas `validada`: en Avanze una carga pendiente todavía no es consumo.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.controllers.empresa_estaciones_controller import cargadores_de, ids_estaciones_empresa
from app.models.calificacion_model import Calificaciones
from app.models.carga_model import Cargas
from app.models.estacion_cargador_model import EstacionCargador
from app.models.estacion_propia_model import EstacionPropia
from app.models.incidente_model import Incidente
from app.models.notificacion_model import Notificacion
from app.models.reporte_model import Reportes
from app.models.reserva_model import Reservas
from app.utils.constantes import (
    CARGADOR_ESTADO_DISPONIBLE,
    EMPRESA_APROBADA,
    ESTADO_CARGA_VALIDADA,
    ESTADO_ESTACION_ACTIVA,
    ESTADO_ESTACION_MANTENIMIENTO,
    ESTADO_REPORTE_ABIERTO,
    ESTADO_RESERVA_ACTIVA,
    ESTADOS_RESERVA_VIGENTES,
    INCIDENTES_NO_CERRADOS,
    ZONA_HORARIA_COLOMBIA,
)

DIAS_MAX_RANGO = 730

# La API expone la granularidad en español; `date_trunc` la exige en inglés.
GRANULARIDADES_SERIE = {"dia": "day", "mes": "month"}


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _rango(desde: datetime | None, hasta: datetime | None) -> tuple[datetime, datetime]:
    fin = _aware(hasta) if hasta else datetime.now(timezone.utc)
    inicio = _aware(desde) if desde else fin - timedelta(days=30)
    if inicio >= fin:
        raise HTTPException(status_code=400, detail="'desde' debe ser anterior a 'hasta'.")
    if (fin - inicio) > timedelta(days=DIAS_MAX_RANGO):
        raise HTTPException(status_code=400, detail=f"El rango de fechas no puede superar {DIAS_MAX_RANGO} días.")
    return inicio, fin


def _cargas_validadas(consulta, ids: list[str], inicio: datetime, fin: datetime):
    return consulta.filter(
        Cargas.estacion_ocm_id.in_(ids),
        Cargas.estado == ESTADO_CARGA_VALIDADA,
        Cargas.fecha >= inicio,
        Cargas.fecha <= fin,
    )


def _suma_validadas(db: Session, ids: list[str], inicio: datetime, fin: datetime) -> tuple[int, float, float]:
    """Cantidad, kWh y costo de las cargas validadas en el rango."""
    if not ids:
        return 0, 0.0, 0.0
    fila = _cargas_validadas(
        db.query(
            func.count(Cargas.id),
            func.coalesce(func.sum(Cargas.kwh_cargados), 0.0),
            func.coalesce(func.sum(Cargas.costo_estimado), 0.0),
        ),
        ids,
        inicio,
        fin,
    ).one()
    return int(fila[0] or 0), float(fila[1] or 0), float(fila[2] or 0)


def _estaciones(db: Session, empresa_id: str) -> list[EstacionPropia]:
    return (
        db.query(EstacionPropia)
        .filter(EstacionPropia.empresa_id == empresa_id, EstacionPropia.eliminada.is_(False))
        .all()
    )


def _cargadores(db: Session, ids: list[str]) -> list[EstacionCargador]:
    return db.query(EstacionCargador).filter(EstacionCargador.estacion_id.in_(ids)).all() if ids else []


def resumen_empresa(ctx: dict, db: Session, desde: datetime | None = None, hasta: datetime | None = None):
    inicio, fin = _rango(desde, hasta)
    estaciones = _estaciones(db, ctx["empresa_id"])
    ids = [e.id for e in estaciones]

    cargas, kwh, ingresos = _suma_validadas(db, ids, inicio, fin)
    anterior_cargas, _, _ = _suma_validadas(db, ids, inicio - (fin - inicio), inicio)
    variacion = round(((cargas - anterior_cargas) / anterior_cargas) * 100, 1) if anterior_cargas else None

    cargadores = _cargadores(db, ids)
    reservas = (
        db.query(func.count(Reservas.id))
        .filter(
            Reservas.estacion_ocm_id.in_(ids),
            Reservas.estado == ESTADO_RESERVA_ACTIVA,
            Reservas.fecha_hora_inicio >= inicio,
            Reservas.fecha_hora_inicio <= fin,
        )
        .scalar()
        or 0
    ) if ids else 0
    promedio, total_resenas = (
        db.query(func.avg(Calificaciones.puntaje), func.count(Calificaciones.id))
        .filter(Calificaciones.estacion_ocm_id.in_(ids))
        .one()
        if ids
        else (None, 0)
    )

    return {
        "desde": inicio,
        "hasta": fin,
        "total_cargas": cargas,
        "total_kwh": round(kwh, 2),
        "ingresos_estimados": round(ingresos, 0),
        "promedio_kwh_por_carga": round(kwh / cargas, 2) if cargas else 0.0,
        "cargas_periodo_anterior": anterior_cargas,
        "variacion_cargas_pct": variacion,
        "total_estaciones": len(estaciones),
        "estaciones_activas": sum(1 for e in estaciones if e.estado == ESTADO_ESTACION_ACTIVA),
        "total_cargadores": len(cargadores),
        "cargadores_disponibles": sum(1 for c in cargadores if c.estado == CARGADOR_ESTADO_DISPONIBLE),
        "reservas_activas": reservas,
        "calificacion_promedio": round(float(promedio), 2) if promedio else None,
        "total_resenas": total_resenas or 0,
    }


def estadisticas_por_estacion(ctx: dict, db: Session, desde: datetime | None = None, hasta: datetime | None = None):
    inicio, fin = _rango(desde, hasta)
    estaciones = _estaciones(db, ctx["empresa_id"])
    if not estaciones:
        return []

    ids = [e.id for e in estaciones]
    cargas = {
        fila[0]: fila[1:]
        for fila in _cargas_validadas(
            db.query(
                Cargas.estacion_ocm_id,
                func.count(Cargas.id),
                func.coalesce(func.sum(Cargas.kwh_cargados), 0.0),
                func.coalesce(func.sum(Cargas.costo_estimado), 0.0),
            ),
            ids,
            inicio,
            fin,
        )
        .group_by(Cargas.estacion_ocm_id)
        .all()
    }
    reservas = dict(
        db.query(Reservas.estacion_ocm_id, func.count(Reservas.id))
        .filter(Reservas.estacion_ocm_id.in_(ids), Reservas.estado == ESTADO_RESERVA_ACTIVA)
        .group_by(Reservas.estacion_ocm_id)
        .all()
    )
    calificaciones = dict(
        db.query(Calificaciones.estacion_ocm_id, func.avg(Calificaciones.puntaje))
        .filter(Calificaciones.estacion_ocm_id.in_(ids))
        .group_by(Calificaciones.estacion_ocm_id)
        .all()
    )
    incidentes = dict(
        db.query(Incidente.estacion_id, func.count(Incidente.id))
        .filter(Incidente.estacion_id.in_(ids), Incidente.estado.in_(INCIDENTES_NO_CERRADOS))
        .group_by(Incidente.estacion_id)
        .all()
    )
    cargadores = dict(
        db.query(EstacionCargador.estacion_id, func.count(EstacionCargador.id))
        .filter(EstacionCargador.estacion_id.in_(ids))
        .group_by(EstacionCargador.estacion_id)
        .all()
    )

    filas = []
    for e in estaciones:
        datos = cargas.get(e.id, (0, 0.0, 0.0))
        filas.append(
            {
                "estacion_id": e.id,
                "nombre": e.nombre,
                "estado": e.estado,
                "total_cargadores": cargadores.get(e.id, 0),
                "cargas": int(datos[0]),
                "kwh": round(float(datos[1]), 2),
                "ingresos": round(float(datos[2]), 0),
                "reservas_activas": reservas.get(e.id, 0),
                "incidentes_abiertos": incidentes.get(e.id, 0),
                "calificacion_promedio": round(float(calificaciones[e.id]), 2) if calificaciones.get(e.id) else None,
            }
        )
    return sorted(filas, key=lambda f: f["kwh"], reverse=True)


def estadisticas_por_cargador(
    ctx: dict,
    db: Session,
    estacion_id: str | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
):
    """Uso por cargador. Criterio de "más usado": número de sesiones (desempata por kWh)."""
    inicio, fin = _rango(desde, hasta)
    ids = ids_estaciones_empresa(db, ctx["empresa_id"])
    vacio = {"resultados": [], "mas_usado": None, "criterio": "sesiones", "total_sesiones_con_cargador": 0}
    if not ids:
        return vacio
    if estacion_id:
        if estacion_id not in ids:
            raise HTTPException(status_code=404, detail="Estación no encontrada.")
        ids = [estacion_id]

    metricas = {
        fila[0]: fila[1:]
        for fila in _cargas_validadas(
            db.query(
                Cargas.cargador_id,
                func.count(Cargas.id),
                func.coalesce(func.sum(Cargas.kwh_cargados), 0.0),
            ),
            ids,
            inicio,
            fin,
        )
        .filter(Cargas.cargador_id.isnot(None))
        .group_by(Cargas.cargador_id)
        .all()
    }
    nombres = dict(db.query(EstacionPropia.id, EstacionPropia.nombre).filter(EstacionPropia.id.in_(ids)).all())
    # Una carga nombra su cargador por id real o por posición en el mapa (`<estacion>-<n>`).
    cargadores = []
    for estacion_id_actual in ids:
        for posicion, c in enumerate(cargadores_de(db, estacion_id_actual), start=1):
            claves = (c.id, f"{estacion_id_actual}-{posicion}")
            medidas = [metricas[k] for k in claves if k in metricas]
            cargadores.append((c, (sum(int(m[0]) for m in medidas), sum(float(m[1]) for m in medidas)) if medidas else None))
    total_sesiones = sum(medida[0] for _, medida in cargadores if medida)

    resultados = []
    for c, medida in cargadores:
        sesiones = int(medida[0]) if medida else 0
        resultados.append(
            {
                "cargador_id": c.id,
                "estacion_id": c.estacion_id,
                "estacion_nombre": nombres.get(c.estacion_id, ""),
                "numero": c.numero or 0,
                "tipo_conector": c.tipo_conector,
                "potencia_kw": c.potencia_kw,
                "estado": c.estado,
                "sesiones": sesiones,
                "kwh": round(float(medida[1]), 2) if medida else 0.0,
                "participacion_pct": round((sesiones / total_sesiones) * 100, 1) if total_sesiones else 0.0,
            }
        )

    mas_usado = max(resultados, key=lambda r: (r["sesiones"], r["kwh"])) if resultados and total_sesiones else None
    return {
        "resultados": resultados,
        "mas_usado": mas_usado,
        "criterio": "sesiones",
        "total_sesiones_con_cargador": total_sesiones,
    }


def serie_temporal(
    ctx: dict,
    db: Session,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    granularidad: str = "dia",
):
    if granularidad not in GRANULARIDADES_SERIE:
        raise HTTPException(
            status_code=400,
            detail=f"granularidad debe ser uno de: {', '.join(sorted(GRANULARIDADES_SERIE))}.",
        )
    if granularidad == "dia" and not desde:
        desde = datetime.now(timezone.utc) - timedelta(days=14)
    inicio, fin = _rango(desde, hasta)

    ids = ids_estaciones_empresa(db, ctx["empresa_id"])
    base = {"granularidad": granularidad, "desde": inicio, "hasta": fin, "zona_horaria": ZONA_HORARIA_COLOMBIA}
    if not ids:
        return {**base, "puntos": []}

    # Las marcas se guardan en UTC; el corte de día/mes se hace en hora de Colombia.
    bucket = func.date_trunc(GRANULARIDADES_SERIE[granularidad], func.timezone(ZONA_HORARIA_COLOMBIA, Cargas.fecha))
    filas = (
        _cargas_validadas(
            db.query(
                bucket.label("periodo"),
                func.count(Cargas.id),
                func.coalesce(func.sum(Cargas.kwh_cargados), 0.0),
                func.coalesce(func.sum(Cargas.costo_estimado), 0.0),
            ),
            ids,
            inicio,
            fin,
        )
        .group_by(bucket)
        .order_by(bucket.asc())
        .all()
    )
    return {
        **base,
        "puntos": [
            {
                "periodo": fila[0],
                "cargas": int(fila[1] or 0),
                "kwh": round(float(fila[2]), 2),
                "ingresos": round(float(fila[3]), 0),
            }
            for fila in filas
        ],
    }


def resenas_empresa(
    ctx: dict,
    db: Session,
    estacion_id: str | None = None,
    puntaje: int | None = None,
    page: int = 1,
    limit: int = 10,
    desde=None,
    hasta=None,
):
    """Reseñas de las estaciones de la empresa.

    `promedio` y `distribucion` son de todo el histórico (la reputación de la estación);
    `desde`/`hasta` acotan solo el listado, que es lo que necesita el reporte mensual.
    """
    page, limit = max(1, page), max(1, min(limit, 100))
    distribucion = {str(p): 0 for p in range(1, 6)}
    vacio = {
        "promedio": None,
        "total_general": 0,
        "total": 0,
        "distribucion": distribucion,
        "page": page,
        "limit": limit,
        "resultados": [],
    }
    ids = ids_estaciones_empresa(db, ctx["empresa_id"])
    if not ids:
        return vacio
    if estacion_id:
        if estacion_id not in ids:
            raise HTTPException(status_code=404, detail="Estación no encontrada.")
        ids = [estacion_id]
    if puntaje is not None and not 1 <= puntaje <= 5:
        raise HTTPException(status_code=400, detail="El puntaje debe estar entre 1 y 5.")

    for valor, cantidad in (
        db.query(Calificaciones.puntaje, func.count(Calificaciones.id))
        .filter(Calificaciones.estacion_ocm_id.in_(ids))
        .group_by(Calificaciones.puntaje)
        .all()
    ):
        if str(valor) in distribucion:
            distribucion[str(valor)] = cantidad

    promedio, total_historico = (
        db.query(func.avg(Calificaciones.puntaje), func.count(Calificaciones.id))
        .filter(Calificaciones.estacion_ocm_id.in_(ids))
        .one()
    )

    consulta = db.query(Calificaciones).filter(Calificaciones.estacion_ocm_id.in_(ids))
    if puntaje is not None:
        consulta = consulta.filter(Calificaciones.puntaje == puntaje)
    if desde:
        consulta = consulta.filter(Calificaciones.fecha >= desde)
    if hasta:
        consulta = consulta.filter(Calificaciones.fecha <= hasta)

    total = consulta.count()
    resenas = (
        consulta.options(joinedload(Calificaciones.usuario))
        .order_by(Calificaciones.fecha.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    nombres = dict(db.query(EstacionPropia.id, EstacionPropia.nombre).filter(EstacionPropia.id.in_(ids)).all())
    return {
        "promedio": round(float(promedio), 2) if promedio else None,
        "total_general": total_historico or 0,
        "total": total,
        "distribucion": distribucion,
        "page": page,
        "limit": limit,
        "resultados": [
            {
                "id": c.id,
                "estacion_id": c.estacion_ocm_id,
                "estacion_nombre": nombres.get(c.estacion_ocm_id, c.estacion_nombre or ""),
                "puntaje": c.puntaje,
                "comentario": c.comentario or "",
                "fecha": c.fecha,
                # Privacidad: nombre sí, correo nunca.
                "usuario_nombre": (
                    f"{c.usuario.nombre} {c.usuario.apellido or ''}".strip() if c.usuario else "Usuario eliminado"
                ),
            }
            for c in resenas
        ],
    }


def dashboard_empresa(ctx: dict, db: Session):
    """Un solo endpoint agregador: evita media docena de llamadas desde los frontends."""
    empresa = ctx["empresa"]
    ahora = datetime.now(timezone.utc)
    inicio_mes = ahora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    estaciones = _estaciones(db, ctx["empresa_id"])
    ids = [e.id for e in estaciones]
    cargadores = _cargadores(db, ids)
    cargas_mes, kwh_mes, ingresos_mes = _suma_validadas(db, ids, inicio_mes, ahora)

    kpis = {
        "total_estaciones": len(estaciones),
        "estaciones_activas": sum(1 for e in estaciones if e.estado == ESTADO_ESTACION_ACTIVA),
        "estaciones_mantenimiento": sum(1 for e in estaciones if e.estado == ESTADO_ESTACION_MANTENIMIENTO),
        "total_cargadores": len(cargadores),
        "cargadores_disponibles": sum(1 for c in cargadores if c.estado == CARGADOR_ESTADO_DISPONIBLE),
        "cargas_mes": cargas_mes,
        "kwh_mes": round(kwh_mes, 2),
        "ingresos_mes": round(ingresos_mes, 0),
        "reservas_proximas": 0,
        "calificacion_promedio": None,
        "total_resenas": 0,
    }

    reportes_pendientes = 0
    if ids:
        kpis["reservas_proximas"] = (
            db.query(func.count(Reservas.id))
            .filter(
                Reservas.estacion_ocm_id.in_(ids),
                Reservas.estado.in_(ESTADOS_RESERVA_VIGENTES),
                Reservas.fecha_hora_inicio >= ahora,
            )
            .scalar()
            or 0
        )
        promedio, total_resenas = (
            db.query(func.avg(Calificaciones.puntaje), func.count(Calificaciones.id))
            .filter(Calificaciones.estacion_ocm_id.in_(ids))
            .one()
        )
        kpis["calificacion_promedio"] = round(float(promedio), 2) if promedio else None
        kpis["total_resenas"] = total_resenas or 0
        reportes_pendientes = (
            db.query(func.count(Reportes.id))
            .filter(Reportes.estacion_ocm_id.in_(ids), Reportes.estado == ESTADO_REPORTE_ABIERTO)
            .scalar()
            or 0
        )

    abiertos = db.query(func.count(Incidente.id)).filter(
        Incidente.empresa_id == ctx["empresa_id"], Incidente.estado.in_(INCIDENTES_NO_CERRADOS)
    )
    incidentes_abiertos = abiertos.scalar() or 0
    incidentes_altos = abiertos.filter(Incidente.prioridad == "alta").scalar() or 0

    alertas = []
    if reportes_pendientes:
        alertas.append({
            "tipo": "reportes",
            "mensaje": f"{reportes_pendientes} reporte(s) de usuarios sin atender",
            "cantidad": reportes_pendientes,
        })
    if incidentes_altos:
        alertas.append({
            "tipo": "incidentes",
            "mensaje": f"{incidentes_altos} incidente(s) de prioridad alta abiertos",
            "cantidad": incidentes_altos,
        })
    if empresa.estado != EMPRESA_APROBADA:
        alertas.append({
            "tipo": "empresa",
            "mensaje": f"Tu empresa está en estado '{empresa.estado}': no puedes publicar ni modificar estaciones.",
            "cantidad": 1,
        })

    notificaciones = (
        db.query(Notificacion)
        .filter(Notificacion.usuario_id == empresa.usuario_id)
        .order_by(Notificacion.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "empresa": {
            "id": empresa.id,
            "nombre_comercial": empresa.nombre_comercial,
            "color_hex": empresa.color_hex,
            "logo_url": empresa.logo_url,
            "estado": empresa.estado,
        },
        "kpis": kpis,
        "alertas": alertas,
        "reportes_pendientes": reportes_pendientes,
        "incidentes_abiertos": incidentes_abiertos,
        "notificaciones": [
            {
                "id": n.id,
                "titulo": n.titulo,
                "mensaje": n.mensaje,
                "tipo": n.tipo,
                "leida": n.leida,
                "created_at": n.created_at,
            }
            for n in notificaciones
        ],
    }
