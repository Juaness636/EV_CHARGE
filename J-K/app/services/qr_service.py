# Backend/services/qr_service.py
"""Códigos QR de los cargadores: cada cargador tiene un QR propio firmado por el servidor.

El QR lleva la estación, el cargador y una firma HMAC con la clave secreta del backend,
así nadie puede fabricar el QR de un cargador sin esa clave. La firma también se imprime
como "código manual" (ABCDE-FGHJK) para escribirlo si la cámara no lee el QR.

- Estaciones propias o de empresa: el QR nombra el id real del cargador (no cambia
  aunque se borren otros cargadores de la estación).
- Estaciones de OpenChargeMap: el QR nombra la referencia posicional `<estacion>-<n>`,
  la misma que usan el mapa y las reservas.
"""

import hashlib
import hmac
import html
import os
from datetime import datetime, timedelta, timezone

import segno
from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.controllers.empresa_estaciones_controller import cargadores_de
from app.models.estacion_propia_model import EstacionPropia
from app.utils.jwt import ALGORITHM, SECRET_KEY

PREFIJO_QR = "EVCHARGE"
# Sin letras ni números que se confundan al escribirlos a mano (0/O, 1/I/L).
_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_LARGO_CODIGO = 10
TOKEN_HOJA_QR = "qr_hoja"
MINUTOS_HOJA_QR = 15

_CLAVE_QR = hmac.new(
    (os.getenv("QR_SECRET") or SECRET_KEY).encode(), b"ev-charge:qr-cargadores", hashlib.sha256
).digest()


def codigo_cargador(estacion_id: str, referencia: str) -> str:
    """Código de 10 caracteres derivado de la firma del cargador, p. ej. "K7MPQ-2XRTA"."""
    firma = hmac.new(_CLAVE_QR, f"{estacion_id}|{referencia}".encode(), hashlib.sha256).digest()
    numero = int.from_bytes(firma, "big")
    letras = []
    for _ in range(_LARGO_CODIGO):
        numero, resto = divmod(numero, len(_ALFABETO))
        letras.append(_ALFABETO[resto])
    codigo = "".join(letras)
    return f"{codigo[:5]}-{codigo[5:]}"


def normalizar_codigo(texto: str) -> str:
    limpio = "".join(c for c in (texto or "").upper() if c.isalnum())
    return f"{limpio[:5]}-{limpio[5:]}" if len(limpio) == _LARGO_CODIGO else limpio


def contenido_qr(estacion_id: str, referencia: str) -> str:
    return f"{PREFIJO_QR}|{estacion_id}|{referencia}|{codigo_cargador(estacion_id, referencia)}"


def leer_qr(texto: str) -> dict:
    """Interpreta lo que leyó la cámara o lo que escribió el usuario.

    Devuelve {"estacion_id", "referencia", "codigo"} para un QR completo, o solo
    {"codigo"} si el usuario escribió el código manual.
    """
    texto = (texto or "").strip()
    if texto.upper().startswith(f"{PREFIJO_QR}|"):
        partes = texto.split("|")
        if len(partes) != 4 or not partes[1] or not partes[2]:
            raise HTTPException(status_code=400, detail="Este código QR no es de un cargador de EV Charge.")
        _, estacion_id, referencia, codigo = partes
        if not hmac.compare_digest(normalizar_codigo(codigo), codigo_cargador(estacion_id, referencia)):
            raise HTTPException(status_code=400, detail="Este código QR no es válido. Pide ayuda al personal de la estación.")
        return {"estacion_id": estacion_id, "referencia": referencia, "codigo": codigo_cargador(estacion_id, referencia)}
    codigo = normalizar_codigo(texto)
    if len(codigo.replace("-", "")) != _LARGO_CODIGO:
        raise HTTPException(
            status_code=400,
            detail="No reconocimos el código. Escanea el QR pegado en el cargador o escribe los 10 caracteres que aparecen debajo.",
        )
    return {"codigo": codigo}


def cargadores_estacion(db: Session, estacion_id: str) -> dict:
    """Nombre de la estación y sus cargadores numerados, con la referencia que firma el QR."""
    propia = db.query(EstacionPropia).filter(EstacionPropia.id == estacion_id, EstacionPropia.eliminada.is_(False)).first()
    if propia:
        cargadores = [
            {"numero": posicion, "referencia": c.id, "tipo": c.tipo_conector, "potencia_kw": c.potencia_kw}
            for posicion, c in enumerate(cargadores_de(db, propia.id), start=1)
        ]
        return {"estacion_id": propia.id, "nombre": propia.nombre, "direccion": propia.direccion or "", "cargadores": cargadores}

    # Import diferido: admin_controller carga módulos pesados (consulta a OpenChargeMap).
    from app.controllers.admin_controller import listar_estaciones_ocm_admin
    externa = next((e for e in listar_estaciones_ocm_admin(db) if e["id"] == estacion_id), None)
    if not externa:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    cargadores = [
        {"numero": posicion, "referencia": f"{estacion_id}-{posicion}", "tipo": c.get("tipo"), "potencia_kw": c.get("potencia_kw")}
        for posicion, c in enumerate(externa.get("conectores") or [], start=1)
    ]
    return {"estacion_id": estacion_id, "nombre": externa["nombre"], "direccion": externa.get("direccion") or "", "cargadores": cargadores}


def qr_de_estacion(db: Session, estacion_id: str) -> dict:
    """QR de cada cargador (imagen PNG para la pantalla) y el enlace de la hoja para imprimir."""
    datos = cargadores_estacion(db, estacion_id)
    for cargador in datos["cargadores"]:
        contenido = contenido_qr(datos["estacion_id"], cargador["referencia"])
        cargador["contenido"] = contenido
        cargador["codigo"] = codigo_cargador(datos["estacion_id"], cargador["referencia"])
        cargador["imagen"] = segno.make(contenido, error="m").png_data_uri(scale=6, border=2)
    datos["hoja_url"] = f"/qr/hoja/{datos['estacion_id']}?ticket={_ticket_hoja(datos['estacion_id'])}"
    return datos


def _ticket_hoja(estacion_id: str) -> str:
    """Permiso corto para abrir la hoja imprimible en el navegador (no lleva la sesión)."""
    vence = datetime.now(timezone.utc) + timedelta(minutes=MINUTOS_HOJA_QR)
    return jwt.encode({"typ": TOKEN_HOJA_QR, "est": estacion_id, "exp": vence}, SECRET_KEY, algorithm=ALGORITHM)


def validar_ticket_hoja(ticket: str, estacion_id: str) -> None:
    try:
        datos = jwt.decode(ticket, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="El enlace para imprimir venció. Vuelve a abrirlo desde el panel.")
    if datos.get("typ") != TOKEN_HOJA_QR or datos.get("est") != estacion_id:
        raise HTTPException(status_code=401, detail="El enlace para imprimir no es válido.")


def hoja_imprimible(db: Session, estacion_id: str) -> str:
    """Página HTML con un QR por cargador, lista para imprimir y pegar en la estación."""
    datos = cargadores_estacion(db, estacion_id)
    nombre = html.escape(datos["nombre"])
    tarjetas = []
    for cargador in datos["cargadores"]:
        contenido = contenido_qr(datos["estacion_id"], cargador["referencia"])
        svg = segno.make(contenido, error="m").svg_inline(scale=8, border=2, dark="#0d0d0d")
        detalle = " · ".join(filter(None, [
            html.escape(str(cargador.get("tipo") or "")),
            f"{cargador['potencia_kw']:g} kW" if cargador.get("potencia_kw") else "",
        ]))
        tarjetas.append(f"""
        <section class="tarjeta">
          <div class="marca">⚡ EV Charge</div>
          <h2>Cargador #{cargador['numero']}</h2>
          <p class="detalle">{detalle}</p>
          <div class="qr">{svg}</div>
          <p class="codigo">{codigo_cargador(datos['estacion_id'], cargador['referencia'])}</p>
          <p class="ayuda">Al llegar, abre tu reserva en la app EV Charge y toca <b>Escanear QR</b>.
          Si la cámara no funciona, escribe el código de arriba.</p>
          <p class="estacion">{nombre}</p>
        </section>""")
    vacio = "" if tarjetas else "<p>Esta estación no tiene cargadores registrados.</p>"
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QR de cargadores · {nombre}</title>
<style>
  body {{ font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f2f4f1; color: #0d0d0d; }}
  header {{ padding: 20px 24px; display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; }}
  header h1 {{ margin: 0; font-size: 20px; }}
  header p {{ margin: 4px 0 0; color: #555; }}
  button {{ background: #39a900; color: #fff; border: 0; border-radius: 10px; padding: 12px 20px; font-size: 16px; cursor: pointer; }}
  main {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; padding: 0 24px 24px; }}
  .tarjeta {{ background: #fff; border: 2px solid #39a900; border-radius: 18px; padding: 20px; text-align: center; break-inside: avoid; page-break-inside: avoid; }}
  .marca {{ font-weight: 700; color: #39a900; letter-spacing: .5px; }}
  h2 {{ margin: 6px 0 2px; font-size: 28px; }}
  .detalle {{ margin: 0 0 10px; color: #444; }}
  .qr svg {{ width: 240px; height: 240px; }}
  .codigo {{ font-family: ui-monospace, Consolas, monospace; font-size: 22px; font-weight: 700; letter-spacing: 2px; margin: 8px 0; }}
  .ayuda {{ font-size: 13px; color: #444; margin: 0 0 8px; }}
  .estacion {{ font-size: 12px; color: #777; margin: 0; }}
  @media print {{
    body {{ background: #fff; }}
    header {{ display: none; }}
    main {{ grid-template-columns: repeat(2, 1fr); padding: 0; gap: 12mm; }}
  }}
</style></head>
<body>
<header>
  <div><h1>QR de cargadores · {nombre}</h1><p>Imprime esta hoja y pega cada QR en su cargador.</p></div>
  <button onclick="window.print()">Imprimir o guardar PDF</button>
</header>
<main>{''.join(tarjetas)}{vacio}</main>
</body></html>"""
