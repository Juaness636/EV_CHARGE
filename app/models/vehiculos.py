import uuid
from sqlalchemy import Column, String, Float, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class vehiculos(Base):
    __tablename__ = "vehiculos"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    marca = Column(String, nullable=False)
    modelo = Column(String, nullable=False)
    anio = Column(Integer, nullable=True)
    autonomia_km = Column(Float, default=300.0)
    tipo_conector = Column(String, nullable=False)
    activo = Column(Boolean, default=True)

    # Apunta al string "usuarios"
    dueno = relationship("usuarios", back_populates="vehiculos_rel")