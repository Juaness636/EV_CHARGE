import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class Cargas(Base):
    __tablename__ = "cargas"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    estacion_id = Column(String)
    energia = Column(String)  
    fecha = Column(String)    
    created_at = Column(DateTime, default=datetime.utcnow)