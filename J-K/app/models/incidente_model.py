# Backend/models/incidente_model.py
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc
from app.utils.constantes import ESTADO_INCIDENTE_ABIERTO, PRIORIDADES_INCIDENTE


class Incidente(Base):
    __tablename__ = "incidentes"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    estacion_id = Column(
        String, ForeignKey("estaciones_propias.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cargador_id = Column(String, ForeignKey("estacion_cargadores.id", ondelete="SET NULL"), nullable=True)
    reporte_id = Column(String, ForeignKey("reportes.id", ondelete="SET NULL"), nullable=True)
    empresa_id = Column(String, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    tipo = Column(String, nullable=False, default="falla")
    titulo = Column(String, nullable=False)
    descripcion = Column(Text, default="")
    prioridad = Column(String, nullable=False, default=PRIORIDADES_INCIDENTE[1])
    bloquea_estacion = Column(Boolean, nullable=False, default=False)
    estado = Column(String, nullable=False, default=ESTADO_INCIDENTE_ABIERTO)
    fecha_inicio = Column(DateTime, nullable=False, default=ahora_utc)
    fecha_fin = Column(DateTime, nullable=True)
    solucion = Column(Text, nullable=True)
    created_at = Column(DateTime, default=ahora_utc)

    estacion = relationship("EstacionPropia")
    cargador = relationship("EstacionCargador")
