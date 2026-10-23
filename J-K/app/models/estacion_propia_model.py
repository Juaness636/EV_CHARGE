# Backend/models/estacion_propia_model.py
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc


class EstacionPropia(Base):
    __tablename__ = "estaciones_propias"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    nombre = Column(String, nullable=False)
    direccion = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    # Campos legados: se derivan del cargador de mayor potencia (ver estacion_cargadores).
    tipo_conector = Column(String, nullable=True)
    potencia_kw = Column(Float, nullable=True)
    descripcion = Column(String, nullable=True, default="")
    operador = Column(String, nullable=True, default="EV Charge")
    activa = Column(Boolean, default=True)
    estado = Column(String, nullable=False, default="activa")  # activa | mantenimiento | inactiva
    # NULL = estación de EV Charge (creada por el admin); con valor = estación de una empresa.
    empresa_id = Column(
        String, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Borrado lógico: conserva historial, reseñas y estadísticas de la estación.
    eliminada = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=ahora_utc)

    empresa = relationship("Empresa", back_populates="estaciones")
