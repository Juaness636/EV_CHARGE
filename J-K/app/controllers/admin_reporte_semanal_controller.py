# Backend/controllers/admin_reporte_semanal_controller.py
"""Reporte semanal del administrador: cómo le fue a la app en una semana.

Convenciones:
- La semana va de lunes 00:00 a domingo 23:59 en hora de Colombia.
- Cada métrica se compara contra la semana anterior del mismo largo.
- El reparto por día se hace en Python: el rango ya está acotado a 7 días y así
  el corte de día en hora de Colombia no depende de la zona de la sesión de Postgres.
"""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.calificacion_model import Calificaciones
from app.models.carga_model import Cargas
from app.models.compra_model import Compras
from app.models.empresa_model import Empresa
from app.models.incidente_model import Incidente
from app.models.pago_reserva_model import PagosReserva
from app.models.reporte_model import Reportes
from app.models.reserva_model import Reservas
from app.models.usuario_model import usuarios
from app.models.vehiculo_model import vehiculos
from app.utils.constantes import (
    EMPRESA_PENDIENTE,
    ESTADO_CARGA_VALIDADA,
    ESTADO_REPORTE_ABIERTO,
    ESTADO_RESERVA_CANCELADA,
    INCIDENTES_NO_CERRADOS,
    ZONA_HORARIA_COLOMBIA,
)

SEMANAS_MAX_ATRAS = 52
DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
DIAS_LARGOS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
PAGO_APROBADO = "aprobado"
COMPRA_APROBADA = "aprobada"


def _zona() -> ZoneInfo:
    return ZoneInfo(ZONA_HORARIA_COLOMBIA)


def _lunes(dia: date) -> date:
    return dia - timedelta(days=dia.weekday())


def _rango_semana(lunes: date) -> tuple[datetime, datetime]:
    """Primer instante UTC de la semana y primer instante de la siguiente (fin exclusivo)."""
    inicio_local = datetime(lunes.year, lunes.month, lunes.day, tzinfo=_zona())
    return inicio_local.astimezone(timezone.utc), (inicio_local + timedelta(days=7)).astimezone(timezone.utc)


def _etiqueta(lunes: date) -> str:
    domingo = lunes + timedelta(days=6)
    if lunes.month == domingo.month:
        return f"{lunes.day} al {domingo.day} de {MESES[domingo.month - 1]} {domingo.year}"
    return f"{lunes.day} {MESES[lunes.month - 1]} al {domingo.day} {MESES[domingo.month - 1]} {domingo.year}"


def _dia_local(valor: datetime | None) -> date | None:
    if valor is None:
        return None
    aware = valor.replace(tzinfo=timezone.utc) if valor.tzinfo is None else valor
    return aware.astimezone(_zona()).date()


def _contar(db: Session, columna, inicio: datetime, fin: datetime, *filtros) -> int:
    return db.query(func.count(columna)).filter(columna >= inicio, columna < fin, *filtros).scalar() or 0


def _sumar(db: Session, valor, columna, inicio: datetime, fin: datetime, *filtros) -> float:
    total = db.query(func.coalesce(func.sum(valor), 0.0)).filter(columna >= inicio, columna < fin, *filtros).scalar()
    return float(total or 0)


def _metricas_semana(db: Session, inicio: datetime, fin: datetime) -> dict[str, float]:
    ingresos_reservas = _sumar(db, PagosReserva.monto, PagosReserva.created_at, inicio, fin, PagosReserva.estado == PAGO_APROBADO)
    ingresos_compras = _sumar(db, Compras.monto, Compras.created_at, inicio, fin, Compras.estado == COMPRA_APROBADA)
    calificacion = (
        db.query(func.avg(Calificaciones.puntaje))
        .filter(Calificaciones.fecha >= inicio, Calificaciones.fecha < fin)
        .scalar()
    )
    return {
        "nuevos_usuarios": _contar(db, usuarios.created_at, inicio, fin),
        "cargas": _contar(db, Cargas.fecha, inicio, fin),
        "cargas_validadas": _contar(db, Cargas.fecha, inicio, fin, Cargas.estado == ESTADO_CARGA_VALIDADA),
        "kwh": round(_sumar(db, Cargas.kwh_cargados, Cargas.fecha, inicio, fin, Cargas.estado == ESTADO_CARGA_VALIDADA), 1),
        "reservas": _contar(db, Reservas.created_at, inicio, fin),
        "reservas_canceladas": _contar(db, Reservas.created_at, inicio, fin, Reservas.estado == ESTADO_RESERVA_CANCELADA),
        "compras": _contar(db, Compras.created_at, inicio, fin, Compras.estado == COMPRA_APROBADA),
        "ingresos_reservas": round(ingresos_reservas),
        "ingresos_compras": round(ingresos_compras),
        "ingresos_totales": round(ingresos_reservas + ingresos_compras),
        "reportes": _contar(db, Reportes.fecha, inicio, fin),
        "incidentes": _contar(db, Incidente.created_at, inicio, fin),
        "calificaciones": _contar(db, Calificaciones.fecha, inicio, fin),
        "calificacion_promedio": round(float(calificacion), 1) if calificacion is not None else 0,
        "nuevos_vehiculos": _contar(db, vehiculos.created_at, inicio, fin),
        "nuevas_empresas": _contar(db, Empresa.created_at, inicio, fin),
    }


# Orden y forma en que el panel muestra cada métrica.
# `positivo`: True si subir es bueno (verde), False si subir es malo (rojo).
DEFINICION_METRICAS = [
    ("nuevos_usuarios", "Nuevos usuarios", "numero", True),
    ("cargas", "Cargas registradas", "numero", True),
    ("cargas_validadas", "Cargas validadas", "numero", True),
    ("kwh", "kWh entregados", "kwh", True),
    ("reservas", "Reservas creadas", "numero", True),
    ("reservas_canceladas", "Reservas canceladas", "numero", False),
    ("compras", "Compras en tienda", "numero", True),
    ("ingresos_totales", "Ingresos totales", "dinero", True),
    ("ingresos_reservas", "Ingresos por reservas", "dinero", True),
    ("ingresos_compras", "Ingresos por tienda", "dinero", True),
    ("reportes", "Reportes de usuarios", "numero", False),
    ("incidentes", "Incidentes", "numero", False),
    ("calificaciones", "Reseñas nuevas", "numero", True),
    ("calificacion_promedio", "Calificación promedio", "estrellas", True),
    ("nuevos_vehiculos", "Vehículos registrados", "numero", True),
    ("nuevas_empresas", "Empresas nuevas", "numero", True),
]


def _variacion(actual: float, anterior: float) -> float | None:
    """Porcentaje de cambio; None si la semana anterior fue cero (no hay base para comparar)."""
    if not anterior:
        return None
    return round((actual - anterior) / anterior * 100, 1)


def _por_dia(db: Session, lunes: date, inicio: datetime, fin: datetime) -> list[dict]:
    dias = [lunes + timedelta(days=i) for i in range(7)]
    cubetas = {d: {"cargas": 0, "kwh": 0.0, "reservas": 0, "nuevos_usuarios": 0, "ingresos": 0.0} for d in dias}

    def repartir(filas, clave, valor=lambda fila: 1):
        for fila in filas:
            dia = _dia_local(fila[0])
            if dia in cubetas:
                cubetas[dia][clave] += valor(fila)

    repartir(db.query(Cargas.fecha).filter(Cargas.fecha >= inicio, Cargas.fecha < fin).all(), "cargas")
    repartir(
        db.query(Cargas.fecha, Cargas.kwh_cargados)
        .filter(Cargas.fecha >= inicio, Cargas.fecha < fin, Cargas.estado == ESTADO_CARGA_VALIDADA)
        .all(),
        "kwh",
        lambda fila: float(fila[1] or 0),
    )
    repartir(db.query(Reservas.created_at).filter(Reservas.created_at >= inicio, Reservas.created_at < fin).all(), "reservas")
    repartir(db.query(usuarios.created_at).filter(usuarios.created_at >= inicio, usuarios.created_at < fin).all(), "nuevos_usuarios")
    repartir(
        db.query(PagosReserva.created_at, PagosReserva.monto)
        .filter(PagosReserva.created_at >= inicio, PagosReserva.created_at < fin, PagosReserva.estado == PAGO_APROBADO)
        .all(),
        "ingresos",
        lambda fila: float(fila[1] or 0),
    )
    repartir(
        db.query(Compras.created_at, Compras.monto)
        .filter(Compras.created_at >= inicio, Compras.created_at < fin, Compras.estado == COMPRA_APROBADA)
        .all(),
        "ingresos",
        lambda fila: float(fila[1] or 0),
    )

    return [
        {
            "fecha": d.isoformat(),
            "dia": DIAS[d.weekday()],
            **{k: (round(v, 1) if isinstance(v, float) else v) for k, v in cubetas[d].items()},
        }
        for d in dias
    ]


def _top_estaciones(db: Session, inicio: datetime, fin: datetime, limite: int = 5) -> list[dict]:
    filas = (
        db.query(
            Cargas.estacion_ocm_id,
            func.max(Cargas.estacion_nombre),
            func.count(Cargas.id),
            func.coalesce(func.sum(Cargas.kwh_cargados), 0.0),
        )
        .filter(Cargas.fecha >= inicio, Cargas.fecha < fin)
        .group_by(Cargas.estacion_ocm_id)
        .order_by(func.count(Cargas.id).desc())
        .limit(limite)
        .all()
    )
    return [
        {"estacion_id": f[0], "estacion_nombre": f[1] or f[0], "cargas": int(f[2] or 0), "kwh": round(float(f[3] or 0), 1)}
        for f in filas
    ]


def _pendientes(db: Session) -> dict[str, int]:
    """Lo que el admin tiene por atender hoy, sin importar la semana elegida."""
    return {
        "cargas_por_validar": db.query(func.count(Cargas.id)).filter(Cargas.estado == "pendiente").scalar() or 0,
        "reportes_abiertos": db.query(func.count(Reportes.id)).filter(Reportes.estado == ESTADO_REPORTE_ABIERTO).scalar() or 0,
        "incidentes_abiertos": db.query(func.count(Incidente.id)).filter(Incidente.estado.in_(INCIDENTES_NO_CERRADOS)).scalar() or 0,
        "empresas_pendientes": db.query(func.count(Empresa.id)).filter(Empresa.estado == EMPRESA_PENDIENTE).scalar() or 0,
    }


def _destacados(metricas: list[dict], top: list[dict], por_dia: list[dict]) -> list[str]:
    """Frases cortas para leer el reporte de un vistazo."""
    por_clave = {m["clave"]: m for m in metricas}
    frases = []
    for clave, sujeto, nombre in (
        ("nuevos_usuarios", "Los nuevos usuarios", "nuevos usuarios"),
        ("cargas", "Las cargas", "cargas"),
        ("ingresos_totales", "Los ingresos", "ingresos"),
    ):
        m = por_clave[clave]
        if m["variacion_pct"] is None:
            if m["actual"] and not m["anterior"]:
                frases.append(f"La semana anterior no hubo {nombre}; esta semana sí.")
        elif m["variacion_pct"] > 0:
            frases.append(f"{sujeto} subieron {m['variacion_pct']:.0f}% frente a la semana anterior.")
        elif m["variacion_pct"] < 0:
            frases.append(f"{sujeto} bajaron {abs(m['variacion_pct']):.0f}% frente a la semana anterior.")
    if top:
        frases.append(f"La estación más usada fue {top[0]['estacion_nombre']} con {top[0]['cargas']} cargas.")
    mejor = max(por_dia, key=lambda d: d["cargas"] + d["reservas"])
    if mejor["cargas"] + mejor["reservas"]:
        dia = date.fromisoformat(mejor["fecha"])
        frases.append(f"El día con más movimiento fue el {DIAS_LARGOS[dia.weekday()]} {dia.day}.")
    if por_clave["incidentes"]["actual"] or por_clave["reportes"]["actual"]:
        frases.append(
            f"Se registraron {por_clave['reportes']['actual']} reportes de usuarios y {por_clave['incidentes']['actual']} incidentes."
        )
    return frases


def obtener_reporte_semanal(db: Session, semanas_atras: int = 0) -> dict:
    if semanas_atras < 0 or semanas_atras > SEMANAS_MAX_ATRAS:
        raise HTTPException(status_code=400, detail=f"Solo se pueden consultar las últimas {SEMANAS_MAX_ATRAS} semanas.")

    hoy = datetime.now(_zona()).date()
    lunes = _lunes(hoy) - timedelta(weeks=semanas_atras)
    lunes_anterior = lunes - timedelta(weeks=1)
    inicio, fin = _rango_semana(lunes)
    inicio_ant, fin_ant = _rango_semana(lunes_anterior)
    if semanas_atras == 0:
        # Semana en curso: se compara contra el mismo tramo de la semana anterior
        # (lunes hasta este mismo día y hora), no contra la semana completa.
        fin = min(fin, datetime.now(timezone.utc))
        fin_ant = inicio_ant + (fin - inicio)

    actual = _metricas_semana(db, inicio, fin)
    anterior = _metricas_semana(db, inicio_ant, fin_ant)
    metricas = [
        {
            "clave": clave,
            "etiqueta": etiqueta,
            "formato": formato,
            "positivo": positivo,
            "actual": actual[clave],
            "anterior": anterior[clave],
            "variacion_pct": _variacion(actual[clave], anterior[clave]),
        }
        for clave, etiqueta, formato, positivo in DEFINICION_METRICAS
    ]
    por_dia = _por_dia(db, lunes, inicio, fin)
    top = _top_estaciones(db, inicio, fin)

    return {
        "semanas_atras": semanas_atras,
        "en_curso": semanas_atras == 0,
        "semana": {"inicio": lunes.isoformat(), "fin": (lunes + timedelta(days=6)).isoformat(), "etiqueta": _etiqueta(lunes)},
        "semana_anterior": {
            "inicio": lunes_anterior.isoformat(),
            "fin": (lunes_anterior + timedelta(days=6)).isoformat(),
            "etiqueta": _etiqueta(lunes_anterior),
        },
        "comparacion": "mismo_tramo" if semanas_atras == 0 else "semana_completa",
        "zona_horaria": ZONA_HORARIA_COLOMBIA,
        "metricas": metricas,
        "por_dia": por_dia,
        "top_estaciones": top,
        "pendientes": _pendientes(db),
        "destacados": _destacados(metricas, top, por_dia),
    }
