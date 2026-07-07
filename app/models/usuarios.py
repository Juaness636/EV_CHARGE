# Backend/models/usuario.py
import uuid
from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from config.database import Base

def generar_uuid():
    return str(uuid.uuid4())

class usuarios(Base):
    __tablename__ = "usuarios"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    
    # 1. Creamos la llave foránea que conecta al Rol (reemplaza a is_admin)
    # Nota: Si ya tienes datos en tu base de datos local, temporalmente puedes dejar nullable=True 
    # para que no te falle por registros viejos sin rol, o dejarlo en False si vas a limpiar la BD.
    role_id = Column(String, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=True)

    # 2. Definimos la relación hacia el modelo Role
    rol_rel = relationship("Role", back_populates="usuarios_rel")

    # Relación uno a muchos con vehículos (se mantiene igual)
    vehiculos_rel = relationship("vehiculos", back_populates="dueno", cascade="all, delete-orphan")