# Backend/controllers/empresa_reporte_controller.py
"""Reporte mensual de la empresa (Fase 7): un documento HTML imprimible.

Se entrega como HTML y el navegador lo imprime o guarda en PDF desde "Imprimir → Guardar
como PDF". Se eligió a conciencia: en este repo no están `reportlab`, `weasyprint` ni
`openpyxl` y añadir dependencias a un proyecto compartido de sustentación cuesta más de
lo que vale. El mes sin datos devuelve un documento con el aviso, no un 500.
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.empresa_controller import get_current_user_empresa
from app.controllers.empresa_estadisticas_controller import (
    estadisticas_por_cargador,
    estadisticas_por_estacion,
    resenas_empresa,
    resumen_empresa,
    serie_temporal,
)
from app.utils.constantes import ZONA_HORARIA_COLOMBIA

MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _rango_mes(mes: str) -> tuple[datetime, datetime, str]:
    """Primer y último instante UTC del mes, cortados en hora de Colombia."""
    try:
        anio, numero = (int(x) for x in mes.split("-")[:2])
        datetime(anio, numero, 1)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Parámetro 'mes' inválido. Usa el formato AAAA-MM (ej: 2026-10).",
        ) from None

    zona = ZoneInfo(ZONA_HORARIA_COLOMBIA)
    inicio_local = datetime(anio, numero, 1, tzinfo=zona)
    fin_local = (
        datetime(anio + 1, 1, 1, tzinfo=zona)
        if numero == 12
        else datetime(anio, numero + 1, 1, tzinfo=zona)
    )
    etiqueta = f"{MESES[numero - 1]} de {anio}"
    return inicio_local.astimezone(timezone.utc), fin_local.astimezone(timezone.utc) - timedelta(microseconds=1), etiqueta


def _e(value) -> str:
    """Escapado: el HTML se arma con datos que escribió el usuario (nombres, motivos)."""
    return (
        str(value if value is not None else "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _copa(valor: float) -> str:
    return f"${valor:,.0f}".replace(",", ".")


def _tabla(filas: list[list[str]], cabeceras: list[str]) -> str:
    if not filas:
        return '<p class="vacio">Sin registros en este periodo.</p>'
    cuerpo = "\n".join(
        "<tr>" + "".join(f"<td>{celda}</td>" for celda in fila) + "</tr>" for fila in filas
    )
    cabeza = "".join(f"<th>{c}</th>" for c in cabeceras)
    return f"<table><thead><tr>{cabeza}</tr></thead><tbody>{cuerpo}</tbody></table>"


def generar_reporte_mensual(
    mes: str,
    ctx: dict = Depends(get_current_user_empresa),
    db: Session = Depends(get_db),
) -> str:
    inicio, fin, etiqueta = _rango_mes(mes)
    resumen = resumen_empresa(desde=inicio, hasta=fin, ctx=ctx, db=db)
    por_estacion = estadisticas_por_estacion(desde=inicio, hasta=fin, ctx=ctx, db=db)
    por_cargador = estadisticas_por_cargador(desde=inicio, hasta=fin, ctx=ctx, db=db)
    serie = serie_temporal(desde=inicio, hasta=fin, granularidad="dia", ctx=ctx, db=db)
    resenas = resenas_empresa(page=1, limit=100, desde=inicio, hasta=fin, ctx=ctx, db=db)

    empresa = ctx["empresa"]

    dias = "".join(
        f"<li>{_e(p['periodo'].strftime('%d/%m/%Y') if p['periodo'] else '—')}: "
        f"{p['cargas']} cargas, {p['kwh']} kWh</li>"
        for p in serie["puntos"][-10:]
    ) or '<li class="vacio">Sin cargas registradas en este mes.</li>'

    tabla_estaciones = _tabla(
        [
            [
                e["nombre"], e["estado"], e["total_cargadores"], e["cargas"],
                f'{e["kwh"]} kWh', _copa(e["ingresos"]), e["incidentes_abiertos"],
            ]
            for e in por_estacion
        ],
        ["Estación", "Estado", "Cargadores", "Cargas", "kWh", "Ingresos", "Incidentes abiertos"],
    )
    tabla_cargadores = _tabla(
        [
            [
                c["estacion_nombre"], f'Cargador {c["numero"]}', c["tipo_conector"],
                f'{c["potencia_kw"]} kW', c["estado"], c["sesiones"],
                f'{c["kwh"]} kWh', f'{c["participacion_pct"]}%',
            ]
            for c in por_cargador["resultados"]
        ],
        ["Estación", "Cargador", "Conector", "Potencia", "Estado", "Sesiones", "kWh", "Participación"],
    )
    tabla_resenas = _tabla(
        [
            [
                r["estacion_nombre"], r["usuario_nombre"], f'{r["puntaje"]}/5',
                (r["comentario"] or "")[:120],
                r["fecha"].strftime("%d/%m/%Y") if r["fecha"] else "—",
            ]
            for r in resenas["resultados"]
        ],
        ["Estación", "Usuario", "Puntaje", "Comentario", "Fecha"],
    )
    mas_usado = por_cargador["mas_usado"]
    mas_usado_texto = (
        f'{mas_usado["estacion_nombre"]} · Cargador {mas_usado["numero"]}'
        if mas_usado
        else "sin uso registrado"
    )
    calificacion = resumen["calificacion_promedio"] or "—"

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte mensual {_e(empresa.nombre_comercial)} — {_e(etiqueta)}</title>
<style>
  :root {{ color-scheme: light; }}
  body {{ font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; margin: 32px; }}
  header {{ border-bottom: 4px solid {_e(empresa.color_hex)}; padding-bottom: 12px; margin-bottom: 20px; }}
  h1 {{ font-size: 22px; margin: 0 0 4px; }}
  h2 {{ font-size: 15px; margin: 26px 0 8px; color: #334155; text-transform: uppercase; letter-spacing: .04em; }}
  .meta {{ color: #64748b; font-size: 13px; }}
  .kpis {{ display: flex; flex-wrap: wrap; gap: 10px; margin: 16px 0; }}
  .kpi {{ flex: 1 1 150px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }}
  .kpi b {{ display: block; font-size: 19px; }}
  .kpi span {{ font-size: 12px; color: #64748b; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th, td {{ text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }}
  th {{ background: #f1f5f9; }}
  .vacio {{ color: #94a3b8; font-style: italic; }}
  footer {{ margin-top: 28px; font-size: 12px; color: #94a3b8; }}
  @media print {{ body {{ margin: 12mm; }} .kpi {{ break-inside: avoid; }} }}
</style>
</head>
<body>
<header>
  <h1>{_e(empresa.nombre_comercial)}</h1>
  <div class="meta">Reporte mensual de operación · {_e(etiqueta)} · Datos de EV Charge</div>
</header>

<div class="kpis">
  <div class="kpi"><b>{resumen["total_cargas"]}</b><span>Cargas completadas</span></div>
  <div class="kpi"><b>{resumen["total_kwh"]} kWh</b><span>Energía despachada</span></div>
  <div class="kpi"><b>{_copa(resumen["ingresos_estimados"])}</b><span>Ingresos estimados (COP)</span></div>
  <div class="kpi"><b>{resumen["duracion_total_min"]} min</b><span>Tiempo de carga</span></div>
  <div class="kpi"><b>{resumen["estaciones_activas"]}/{resumen["total_estaciones"]}</b><span>Estaciones activas</span></div>
  <div class="kpi"><b>{resumen["cargadores_disponibles"]}/{resumen["total_cargadores"]}</b><span>Cargadores disponibles</span></div>
  <div class="kpi"><b>{calificacion}</b><span>Calificación promedio ({resumen["total_resenas"]} reseñas)</span></div>
</div>

<h2>Uso por estación</h2>
{tabla_estaciones}

<h2>Uso por cargador</h2>
{tabla_cargadores}

<p class="meta">Cargador más usado: <strong>{_e(mas_usado_texto)}</strong> (criterio: sesiones completadas).</p>

<h2>Últimos días con actividad</h2>
<ul>{dias}</ul>

<h2>Reseñas recibidas</h2>
{tabla_resenas}

<footer>
  Generado el {datetime.now(ZoneInfo(ZONA_HORARIA_COLOMBIA)).strftime("%d/%m/%Y %H:%M")} (hora de Colombia).
  Los ingresos son una estimación a partir del costo registrado en cada carga completada: no hay medición
  física ni integración OCPP con los cargadores.
</footer>
</body>
</html>
"""
