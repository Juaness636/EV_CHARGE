# Backend/models/role.py
import uuid
from sqlalchemy import Column, String
from sqlalchemy.orm import relationship
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class Role(Base):
    __tablename__ = "roles"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    nombre = Column(String, unique=True, nullable=False, index=True)  # Ej: "admin", "usuario", "operador"
    descripcion = Column(String, nullable=True)

    # Relación inversa: Un rol puede pertenecer a muchos usuarios
    usuarios_rel = relationship("usuarios", back_populates="rol_rel")