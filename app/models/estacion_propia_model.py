# Backend/models/estacion_propia_model.py
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String
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
    tipo_conector = Column(String, nullable=True)
    potencia_kw = Column(Float, nullable=True)
    descripcion = Column(String, nullable=True, default="")
    operador = Column(String, nullable=True, default="EV Charge")
    activa = Column(Boolean, default=True)
    estado = Column(String, nullable=False, default="activa")  # activa | mantenimiento | inactiva
    # NULL = estación de EV Charge (creada por el admin); empresa distinta = estación de empresa.
    empresa_id = Column(
        String, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=True, index=True
    )
    eliminada = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=ahora_utc)

    empresa = relationship("Empresa", back_populates="estaciones")
    cargadores = relationship(
        "Cargador",
        back_populates="estacion",
        cascade="all, delete-orphan",
        order_by="Cargador.numero",
    )
    incidentes = relationship(
        "Incidente",
        back_populates="estacion",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
