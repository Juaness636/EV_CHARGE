import uuid
from sqlalchemy import Column, String
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class empresas(Base):
    __tablename__ = "empresas"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    nombre = Column(String, nullable=False)
    correo = Column(String, nullable=False)
    nombre_cargador = Column(String, nullable=False)