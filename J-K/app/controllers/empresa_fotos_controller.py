# Backend/controllers/empresa_fotos_controller.py
"""Fotos de las estaciones, guardadas en la base de datos.

Una foto pertenece a una estación propia (estaciones_propias) o a una estación de
OpenChargeMap (por su ID de la API). Quién puede subirlas:

- La empresa, solo a sus estaciones: las propias se cargan con `obtener_estacion_de_empresa`
  (id + empresa_id del token) y las de la API deben coincidir con sus palabras clave.
  Para cualquier otra estación responde 404, así Enel nunca toca las de Terpel.
- El admin, a cualquier estación.

El archivo se valida por su firma binaria (JPEG, PNG o WebP) y nunca se usa el nombre ni
el tipo que manda el cliente. Las fotos son públicas en `/media/fotos/{id}` para el mapa.
"""

import os
import uuid
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.controllers.empresa_estaciones_controller import obtener_estacion_de_empresa, serializar_estacion
from app.controllers.historial_controller import registrar_historial
from app.models.estacion_propia_model import EstacionPropia
from app.models.foto_estacion_model import FotoEstacion
from app.utils.constantes import (
    ACCION_HISTORIAL_QUITAR_FOTO,
    ACCION_HISTORIAL_SUBIR_FOTO,
    FOTO_TAMANO_MAXIMO_BYTES,
    FOTOS_MAXIMAS_POR_ESTACION,
)

PREFIJO_URL_MEDIA = "/media"
# Antes las fotos se guardaban en disco; solo se usa para pasarlas a la base al arrancar.
DIRECTORIO_FOTOS_ANTIGUO = Path(os.getenv("MEDIA_DIR") or Path(__file__).resolve().parents[2] / "uploads")


def url_foto(foto: FotoEstacion) -> str:
    return f"{PREFIJO_URL_MEDIA}/fotos/{foto.id}"


def foto_out(foto: FotoEstacion) -> dict:
    return {"id": foto.id, "url": url_foto(foto)}


def _filtro(estacion_id: str | None, estacion_ocm_id: str | None):
    if estacion_ocm_id is not None:
        return FotoEstacion.estacion_ocm_id == estacion_ocm_id
    return FotoEstacion.estacion_id == estacion_id


def fotos_de(db: Session, estacion_id: str | None = None, *, estacion_ocm_id: str | None = None) -> list[FotoEstacion]:
    return (
        db.query(FotoEstacion)
        .filter(_filtro(estacion_id, estacion_ocm_id))
        .order_by(FotoEstacion.created_at.asc(), FotoEstacion.id.asc())
        .all()
    )


def fotos_por_estacion(db: Session) -> tuple[dict[str, list[dict]], dict[str, list[dict]]]:
    """Una sola consulta para el mapa: ({estacion_propia_id: [...]}, {estacion_ocm_id: [...]})."""
    propias: dict[str, list[dict]] = {}
    externas: dict[str, list[dict]] = {}
    for foto in db.query(FotoEstacion).order_by(FotoEstacion.created_at.asc(), FotoEstacion.id.asc()).all():
        if foto.estacion_ocm_id is not None:
            externas.setdefault(foto.estacion_ocm_id, []).append(foto_out(foto))
        else:
            propias.setdefault(foto.estacion_id, []).append(foto_out(foto))
    return propias, externas


def _tipo_por_firma(contenido: bytes) -> tuple[str, str] | None:
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if len(contenido) >= 12 and contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def _snapshot(estacion) -> SimpleNamespace:
    """Lo que la bitácora guarda de la estación, sea un modelo propio o un dict de la API."""
    if isinstance(estacion, dict):
        return SimpleNamespace(id=str(estacion["id"]), nombre=estacion.get("nombre") or "", direccion=estacion.get("direccion") or "")
    return estacion


async def _guardar(
    db: Session,
    archivo: UploadFile,
    *,
    estacion_id: str | None = None,
    estacion_ocm_id: str | None = None,
    usuario_id: str | None,
    bitacora: dict | None,
) -> FotoEstacion:
    if len(fotos_de(db, estacion_id, estacion_ocm_id=estacion_ocm_id)) >= FOTOS_MAXIMAS_POR_ESTACION:
        raise HTTPException(
            status_code=400,
            detail=f"Cada estación admite máximo {FOTOS_MAXIMAS_POR_ESTACION} fotos. Borra una antes de subir otra.",
        )

    # Se lee un byte de más para saber si el archivo supera el límite sin cargarlo entero.
    contenido = await archivo.read(FOTO_TAMANO_MAXIMO_BYTES + 1)
    if len(contenido) > FOTO_TAMANO_MAXIMO_BYTES:
        raise HTTPException(status_code=413, detail="La foto supera el tamaño máximo de 5 MB.")
    tipo = _tipo_por_firma(contenido)
    if not tipo:
        raise HTTPException(status_code=400, detail="Formato no válido. Sube una foto JPG, PNG o WebP.")
    mime, extension = tipo

    foto = FotoEstacion(
        estacion_id=estacion_id,
        estacion_ocm_id=estacion_ocm_id,
        archivo=f"{uuid.uuid4().hex}.{extension}",
        tipo=mime,
        tamano_bytes=len(contenido),
        contenido=contenido,
        subida_por=usuario_id,
    )
    db.add(foto)
    if bitacora:
        registrar_historial(db, accion=ACCION_HISTORIAL_SUBIR_FOTO, detalle={"archivo": foto.archivo}, **bitacora)
    db.commit()
    return foto


def _borrar(
    db: Session,
    foto_id: str,
    *,
    estacion_id: str | None = None,
    estacion_ocm_id: str | None = None,
    bitacora: dict | None,
) -> None:
    foto = db.query(FotoEstacion).filter(FotoEstacion.id == foto_id, _filtro(estacion_id, estacion_ocm_id)).first()
    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada.")
    db.delete(foto)
    if bitacora:
        registrar_historial(db, accion=ACCION_HISTORIAL_QUITAR_FOTO, detalle={"archivo": foto.archivo}, **bitacora)
    db.commit()


def _bitacora_empresa(ctx: dict, estacion) -> dict:
    return {
        "empresa_id": ctx["empresa_id"],
        "usuario_id": ctx["usuario_id"],
        "usuario_nombre": ctx["usuario_nombre"],
        "estacion": _snapshot(estacion),
    }


# ---------- Empresa: estaciones propias ----------

async def subir_foto(estacion_id: str, archivo: UploadFile, ctx: dict, db: Session):
    estacion = obtener_estacion_de_empresa(db, ctx["empresa"].id, estacion_id)
    await _guardar(db, archivo, estacion_id=estacion.id, usuario_id=ctx["usuario_id"], bitacora=_bitacora_empresa(ctx, estacion))
    db.refresh(estacion)
    return serializar_estacion(db, estacion)


def eliminar_foto(estacion_id: str, foto_id: str, ctx: dict, db: Session):
    estacion = obtener_estacion_de_empresa(db, ctx["empresa"].id, estacion_id)
    _borrar(db, foto_id, estacion_id=estacion.id, bitacora=_bitacora_empresa(ctx, estacion))
    db.refresh(estacion)
    return serializar_estacion(db, estacion)


# ---------- Empresa: estaciones de la API asignadas por palabras clave ----------

def _estacion_api_de_empresa(ctx: dict, db: Session, estacion_ocm_id: str) -> dict:
    # Import local: empresa_estaciones_api_controller importa admin_controller, que importa este módulo.
    from app.controllers.empresa_estaciones_api_controller import listar_estaciones_api_empresa

    for estacion in listar_estaciones_api_empresa(ctx, db):
        if estacion["id"] == estacion_ocm_id:
            return estacion
    # 404 y no 403: no se revela si la estación existe para otra empresa.
    raise HTTPException(status_code=404, detail="Estación no encontrada.")


async def subir_foto_api(estacion_ocm_id: str, archivo: UploadFile, ctx: dict, db: Session) -> list[dict]:
    estacion = _estacion_api_de_empresa(ctx, db, estacion_ocm_id)
    await _guardar(db, archivo, estacion_ocm_id=estacion["id"], usuario_id=ctx["usuario_id"], bitacora=_bitacora_empresa(ctx, estacion))
    return [foto_out(foto) for foto in fotos_de(db, estacion_ocm_id=estacion["id"])]


def eliminar_foto_api(estacion_ocm_id: str, foto_id: str, ctx: dict, db: Session) -> list[dict]:
    estacion = _estacion_api_de_empresa(ctx, db, estacion_ocm_id)
    _borrar(db, foto_id, estacion_ocm_id=estacion["id"], bitacora=_bitacora_empresa(ctx, estacion))
    return [foto_out(foto) for foto in fotos_de(db, estacion_ocm_id=estacion["id"])]


# ---------- Admin: cualquier estación ----------

def _estacion_admin(db: Session, eid: str) -> tuple[dict, dict]:
    """Devuelve ({estacion_id | estacion_ocm_id}, estación) para el id de la lista del admin."""
    propia = db.query(EstacionPropia).filter(EstacionPropia.id == eid, EstacionPropia.eliminada.is_(False)).first()
    if propia:
        return {"estacion_id": propia.id}, {"empresa_id": propia.empresa_id, "estacion": propia}
    from app.controllers.admin_controller import listar_estaciones_ocm_admin

    for estacion in listar_estaciones_ocm_admin(db):
        if estacion.get("origen") == "OpenChargeMap" and estacion["id"] == eid:
            return {"estacion_ocm_id": eid}, {"empresa_id": (estacion.get("empresa") or {}).get("id"), "estacion": estacion}
    raise HTTPException(status_code=404, detail="Estación no encontrada.")


def _bitacora_admin(admin, info: dict) -> dict | None:
    # Si la estación es de una empresa, la empresa ve en su bitácora que el admin cambió sus fotos.
    if not info["empresa_id"]:
        return None
    return {
        "empresa_id": info["empresa_id"],
        "usuario_id": admin.id,
        "usuario_nombre": f"Administrador · {admin.nombre}",
        "estacion": _snapshot(info["estacion"]),
    }


def listar_fotos_admin(eid: str, db: Session) -> list[dict]:
    clave, _ = _estacion_admin(db, eid)
    return [foto_out(foto) for foto in fotos_de(db, clave.get("estacion_id"), estacion_ocm_id=clave.get("estacion_ocm_id"))]


async def subir_foto_admin(eid: str, archivo: UploadFile, admin, db: Session) -> list[dict]:
    clave, info = _estacion_admin(db, eid)
    await _guardar(db, archivo, usuario_id=admin.id, bitacora=_bitacora_admin(admin, info), **clave)
    return [foto_out(foto) for foto in fotos_de(db, clave.get("estacion_id"), estacion_ocm_id=clave.get("estacion_ocm_id"))]


def eliminar_foto_admin(eid: str, foto_id: str, admin, db: Session) -> list[dict]:
    clave, info = _estacion_admin(db, eid)
    _borrar(db, foto_id, bitacora=_bitacora_admin(admin, info), **clave)
    return [foto_out(foto) for foto in fotos_de(db, clave.get("estacion_id"), estacion_ocm_id=clave.get("estacion_ocm_id"))]


# ---------- Público ----------

def obtener_contenido_foto(foto_id: str, db: Session) -> FotoEstacion:
    foto = db.query(FotoEstacion).filter(FotoEstacion.id == foto_id, FotoEstacion.contenido.isnot(None)).first()
    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada.")
    return foto


def migrar_fotos_de_disco(db: Session) -> None:
    """Pasa a la base las fotos que se guardaron en disco antes de este cambio."""
    pendientes = db.query(FotoEstacion).filter(FotoEstacion.contenido.is_(None)).all()
    for foto in pendientes:
        ruta = DIRECTORIO_FOTOS_ANTIGUO / "estaciones" / str(foto.estacion_id) / foto.archivo
        if ruta.is_file():
            foto.contenido = ruta.read_bytes()
        else:
            # Sin archivo no hay foto que mostrar.
            db.delete(foto)
    if pendientes:
        db.commit()
