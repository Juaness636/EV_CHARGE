# Backend/routes/media_routes.py
"""Fotos públicas de las estaciones, leídas de la base de datos (las ve cualquiera en el mapa)."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.config.database import get_db
from app.controllers.empresa_fotos_controller import PREFIJO_URL_MEDIA, obtener_contenido_foto

router = APIRouter(prefix=PREFIJO_URL_MEDIA, tags=["Fotos"])


@router.get("/fotos/{foto_id}")
def foto_estacion(foto_id: str, db: Session = Depends(get_db)):
    foto = obtener_contenido_foto(foto_id, db)
    # Cada foto tiene id propio y no cambia: el navegador y la app pueden guardarla en caché.
    return Response(
        content=foto.contenido,
        media_type=foto.tipo,
        headers={"Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"},
    )
