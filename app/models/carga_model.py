# Backend/models/carga_model.py
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc
from app.utils.constantes import ESTADO_CARGA_COMPLETADA


class Cargas(Base):
    __tablename__ = "cargas"
    __table_args__ = (
        Index("ix_cargas_estacion_fecha", "estacion_ocm_id", "fecha"),
        Index("ix_cargas_estado_fecha_fin", "estado", "fecha_fin"),
    )

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    estacion_ocm_id = Column(String, nullable=False)
    estacion_nombre = Column(String, default="")
    cargador_id = Column(String, ForeignKey("cargadores.id", ondelete="SET NULL"), nullable=True)
    reserva_id = Column(String, nullable=True)
    kwh_cargados = Column(Float, nullable=True)
    costo_estimado = Column(Float, nullable=True)
    duracion_min = Column(Integer, nullable=True)
    estado = Column(String, nullable=False, default=ESTADO_CARGA_COMPLETADA)
    fecha = Column(DateTime, default=ahora_utc)
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    notas = Column(Text, default="")

    usuario = relationship("usuarios", back_populates="cargas_rel")
    cargador = relationship("Cargador")
