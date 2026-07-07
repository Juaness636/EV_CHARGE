import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class Favoritos(Base):
    __tablename__ = "favoritos"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    estacion_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)