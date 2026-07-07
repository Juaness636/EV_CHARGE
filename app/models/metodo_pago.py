import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class MetodosPago(Base):
    __tablename__ = "metodos_pago"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    tipo = Column(String(30))
    numero = Column(String(30))
    estado = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)