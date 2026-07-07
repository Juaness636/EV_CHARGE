import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class Reservas(Base):
    __tablename__ = "reservas"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    espacio_id = Column(String)
    fecha = Column(String)  
    estado = Column(String, default="activa")
    created_at = Column(DateTime, default=datetime.utcnow)