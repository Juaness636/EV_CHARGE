# Backend/models/historial_estacion_model.py
from sqlalchemy import Column, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc


class HistorialEstacion(Base):
    """Bitácora de solo inserción: no tiene rutas de edición ni borrado."""

    __tablename__ = "historial_estaciones"
    __table_args__ = (
        Index("ix_historial_empresa_fecha", "empresa_id", "fecha"),
        Index("ix_historial_estacion_fecha", "estacion_id", "fecha"),
    )

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    # Sin FK a estaciones: borrar una estación no debe borrar su historia.
    estacion_id = Column(String, nullable=False, index=True)
    estacion_nombre = Column(String, nullable=False, default="")
    direccion = Column(String, nullable=False, default="")
    empresa_id = Column(String, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    # Sin FK a usuarios: el registro debe sobrevivir si la cuenta se elimina.
    usuario_id = Column(String, nullable=True)
    usuario_nombre = Column(String, nullable=False, default="")
    accion = Column(String, nullable=False)
    motivo = Column(String, nullable=False, default="")
    detalle = Column(JSONB, nullable=True)
    fecha = Column(DateTime, nullable=False, default=ahora_utc, index=True)
