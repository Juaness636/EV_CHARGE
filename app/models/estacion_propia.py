import uuid
from sqlalchemy import Column, String, Float, Boolean
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class EstacionPropia(Base):
    __tablename__ = "estaciones_propias"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    nombre = Column(String, nullable=False)
    direccion = Column(String, nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    tipo_conector = Column(String, nullable=False)
    potencia_kw = Column(Float, nullable=False)
    descripcion = Column(String, nullable=True)
    activa = Column(Boolean, default=True)