# Backend/models/foto_estacion_model.py
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import deferred

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc


class FotoEstacion(Base):
    """Foto de una estación, guardada en la base de datos.

    La estación es propia (estaciones_propias, estacion_id) o viene de OpenChargeMap
    (estacion_ocm_id, el ID de la API): siempre una de las dos.
    """

    __tablename__ = "fotos_estacion"
    __table_args__ = (
        CheckConstraint(
            "(estacion_id IS NULL) <> (estacion_ocm_id IS NULL)",
            name="ck_fotos_estacion_una_estacion",
        ),
    )

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    estacion_id = Column(String, ForeignKey("estaciones_propias.id", ondelete="CASCADE"), nullable=True, index=True)
    estacion_ocm_id = Column(String, nullable=True, index=True)
    # Nombre generado por el servidor (uuid + extensión según el contenido real), nunca el del cliente.
    archivo = Column(String, nullable=False)
    tipo = Column(String, nullable=False)
    tamano_bytes = Column(Integer, nullable=False)
    # Diferido: listar fotos para el mapa no carga los bytes de cada imagen.
    contenido = deferred(Column(LargeBinary, nullable=True))
    subida_por = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=ahora_utc)
