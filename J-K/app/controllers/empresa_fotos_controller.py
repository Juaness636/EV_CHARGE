# Backend/controllers/empresa_fotos_controller.py
"""Fotos de las estaciones de empresa.

Solo la empresa dueña sube o borra fotos: la estación se carga siempre con
`obtener_estacion_de_empresa` (id + empresa_id del token), así una empresa nunca toca
las estaciones de otra. Las fotos se ven en el mapa público a través de `/media`.

El archivo se valida por su firma binaria (JPEG, PNG o WebP) y se guarda con un nombre
generado aquí: nunca se usa el nombre ni el tipo que manda el cliente.
"""

import os
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.controllers.empresa_estaciones_controller import obtener_estacion_de_empresa, serializar_estacion
from app.controllers.historial_controller import registrar_historial
from app.models.foto_estacion_model import FotoEstacion
from app.utils.constantes import (
    ACCION_HISTORIAL_QUITAR_FOTO,
    ACCION_HISTORIAL_SUBIR_FOTO,
    FOTO_TAMANO_MAXIMO_BYTES,
    FOTOS_MAXIMAS_POR_ESTACION,
)

# Por defecto J-K/uploads; MEDIA_DIR permite moverlo a un disco persistente en producción.
DIRECTORIO_MEDIA = Path(os.getenv("MEDIA_DIR") or Path(__file__).resolve().parents[2] / "uploads")
PREFIJO_URL_MEDIA = "/media"


def carpeta_estacion(estacion_id: str) -> Path:
    return DIRECTORIO_MEDIA / "estaciones" / estacion_id


def url_foto(foto: FotoEstacion) -> str:
    return f"{PREFIJO_URL_MEDIA}/estaciones/{foto.estacion_id}/{foto.archivo}"


def fotos_de(db: Session, estacion_id: str) -> list[FotoEstacion]:
    return (
        db.query(FotoEstacion)
        .filter(FotoEstacion.estacion_id == estacion_id)
        .order_by(FotoEstacion.created_at.asc(), FotoEstacion.id.asc())
        .all()
    )


def urls_fotos_por_estacion(db: Session, estacion_ids: list[str]) -> dict[str, list[str]]:
    """Una sola consulta para el mapa: {estacion_id: [url, ...]}."""
    if not estacion_ids:
        return {}
    resultado: dict[str, list[str]] = {}
    for foto in (
        db.query(FotoEstacion)
        .filter(FotoEstacion.estacion_id.in_(estacion_ids))
        .order_by(FotoEstacion.created_at.asc(), FotoEstacion.id.asc())
        .all()
    ):
        resultado.setdefault(foto.estacion_id, []).append(url_foto(foto))
    return resultado


def _tipo_por_firma(contenido: bytes) -> tuple[str, str] | None:
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if len(contenido) >= 12 and contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


async def subir_foto(estacion_id: str, archivo: UploadFile, ctx: dict, db: Session):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    if len(fotos_de(db, estacion.id)) >= FOTOS_MAXIMAS_POR_ESTACION:
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

    carpeta = carpeta_estacion(estacion.id)
    carpeta.mkdir(parents=True, exist_ok=True)
    nombre = f"{uuid.uuid4().hex}.{extension}"
    (carpeta / nombre).write_bytes(contenido)

    foto = FotoEstacion(
        estacion_id=estacion.id,
        archivo=nombre,
        tipo=mime,
        tamano_bytes=len(contenido),
        subida_por=ctx["usuario_id"],
    )
    db.add(foto)
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_SUBIR_FOTO,
        detalle={"archivo": nombre},
    )
    try:
        db.commit()
    except Exception:
        (carpeta / nombre).unlink(missing_ok=True)
        raise
    db.refresh(estacion)
    return serializar_estacion(db, estacion)


def eliminar_foto(estacion_id: str, foto_id: str, ctx: dict, db: Session):
    empresa = ctx["empresa"]
    estacion = obtener_estacion_de_empresa(db, empresa.id, estacion_id)
    foto = (
        db.query(FotoEstacion)
        .filter(FotoEstacion.id == foto_id, FotoEstacion.estacion_id == estacion.id)
        .first()
    )
    if not foto:
        raise HTTPException(status_code=404, detail="Foto no encontrada.")

    ruta = carpeta_estacion(estacion.id) / foto.archivo
    db.delete(foto)
    registrar_historial(
        db,
        empresa_id=empresa.id,
        usuario_id=ctx["usuario_id"],
        usuario_nombre=ctx["usuario_nombre"],
        estacion=estacion,
        accion=ACCION_HISTORIAL_QUITAR_FOTO,
        detalle={"archivo": foto.archivo},
    )
    db.commit()
    ruta.unlink(missing_ok=True)
    db.refresh(estacion)
    return serializar_estacion(db, estacion)
