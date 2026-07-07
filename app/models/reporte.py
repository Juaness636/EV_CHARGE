import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class Reportes(Base):
    __tablename__ = "reportes"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    descripcion = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)