from sqlalchemy import Column, Float, Integer, String

from app.config.database import Base
from app.models.utils import generar_uuid
from app.utils.constantes import CARGADOR_ESTADO_DISPONIBLE


class EstacionCargador(Base):
    __tablename__ = "estacion_cargadores"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    estacion_id = Column(String, nullable=False, index=True)
    # Número visible del cargador dentro de su estación (1, 2, 3...).
    numero = Column(Integer, nullable=True)
    tipo_conector = Column(String, nullable=False)
    potencia_kw = Column(Float, nullable=False)
    corriente = Column(String, nullable=True, default="No especificada")
    bahias = Column(Integer, nullable=False, default=1)
    estado = Column(String, nullable=False, default=CARGADOR_ESTADO_DISPONIBLE)  # disponible | fuera_servicio
