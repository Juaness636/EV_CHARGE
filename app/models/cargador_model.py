# Backend/models/cargador_model.py
from sqlalchemy import CheckConstraint, Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc
from app.utils.constantes import ESTADOS_CARGADOR


class Cargador(Base):
    __tablename__ = "cargadores"
    __table_args__ = (
        UniqueConstraint("estacion_id", "numero", name="uq_cargador_estacion_numero"),
        CheckConstraint("potencia_kw > 0", name="ck_cargador_potencia_positiva"),
    )

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    estacion_id = Column(
        String, ForeignKey("estaciones_propias.id", ondelete="CASCADE"), nullable=False, index=True
    )
    numero = Column(Integer, nullable=False)
    tipo_conector = Column(String, nullable=False)
    potencia_kw = Column(Float, nullable=False)
    estado = Column(String, nullable=False, default=ESTADOS_CARGADOR[0])
    created_at = Column(DateTime, default=ahora_utc)

    estacion = relationship("EstacionPropia", back_populates="cargadores")
