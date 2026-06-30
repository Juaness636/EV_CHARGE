# Backend/models/models.py
import uuid
from sqlalchemy import Column, String, Float, Boolean, Integer, ForeignKey,DateTime,Text
from datetime import datetime
from sqlalchemy.orm import relationship
from config.database import Base
from datetime import datetime

# Función auxiliar para generar UUIDs en formato de texto
def generar_uuid():
    return str(uuid.uuid4())

class usuarios(Base):
    __tablename__ = "usuarios"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    nombre = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)

    # Relación uno a muchos con vehículos (Un usuario puede tener varios carros)
    vehiculos_rel = relationship("vehiculos", back_populates="dueno", cascade="all, delete-orphan")

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

    # Relación inversa hacia el usuario dueño
    dueno = relationship("usuarios", back_populates="vehiculos_rel")

class empresas(Base):
    __tablename__ = "empresas"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    nombre = Column(String, nullable=False)
    correo = Column(String, nullable=False)
    nombre_cargador = Column(String, nullable=False)

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



    # ==============================
# CARGAS
# ==============================
class Cargas(Base):
    __tablename__ = "cargas"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    estacion_id = Column(String)
    energia = Column(String)  # o Float si quieres mejor
    fecha = Column(String)    # o DateTime
    created_at = Column(DateTime, default=datetime.utcnow)

# ==============================
# FAVORITOS
# ==============================
class Favoritos(Base):
    __tablename__ = "favoritos"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    estacion_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# ==============================
# REPORTES
# ==============================
class Reportes(Base):
    __tablename__ = "reportes"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    descripcion = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# ==============================
# RESERVAS
# ==============================
class Reservas(Base):
    __tablename__ = "reservas"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    espacio_id = Column(String)
    fecha = Column(String)  # o DateTime si quieres más pro
    estado = Column(String, default="activa")
    created_at = Column(DateTime, default=datetime.utcnow)

# ==============================
# CALIFICACIONES
# ==============================
class Calificaciones(Base):
    __tablename__ = "calificaciones"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    estacion_id = Column(String)
    puntuacion = Column(Integer)
    comentario = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# ==============================
# METODOS DE PAGO
# ==============================
class MetodosPago(Base):
    __tablename__ = "metodos_pago"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String)
    tipo = Column(String(30))
    numero = Column(String(30))
    estado = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)