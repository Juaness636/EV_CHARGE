# Backend/models/foto_estacion_model.py
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc


class FotoEstacion(Base):
    """Foto de una estación de empresa. El archivo vive en MEDIA_DIR/estaciones/<estacion_id>/."""

    __tablename__ = "fotos_estacion"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    estacion_id = Column(String, ForeignKey("estaciones_propias.id", ondelete="CASCADE"), nullable=False, index=True)
    # Nombre generado por el servidor (uuid + extensión según el contenido real), nunca el del cliente.
    archivo = Column(String, nullable=False)
    tipo = Column(String, nullable=False)
    tamano_bytes = Column(Integer, nullable=False)
    subida_por = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=ahora_utc)
