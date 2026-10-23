# Backend/models/empresa_model.py
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc
from app.utils.constantes import EMPRESA_PENDIENTE


class Empresa(Base):
    __tablename__ = "empresas"

    id = Column(String, primary_key=True, default=generar_uuid, index=True)
    usuario_id = Column(
        String, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    nombre_comercial = Column(String, nullable=False)
    razon_social = Column(String, nullable=True)
    nit = Column(String, nullable=True, unique=True)
    telefono = Column(String, nullable=True)
    email_contacto = Column(String, nullable=True)
    direccion_sede = Column(String, nullable=True)
    descripcion = Column(Text, nullable=True)
    color_hex = Column(String(7), nullable=False, default="#16a34a")
    logo_url = Column(String, nullable=True)
    # Palabras separadas por coma ("enel x, enelx"): las estaciones de la API cuyo nombre u
    # operador las contenga pasan a esta empresa (ver utils/estaciones_empresa.py).
    palabras_clave = Column(String, nullable=True)
    estado = Column(String, nullable=False, default=EMPRESA_PENDIENTE)
    creada_por_admin = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=ahora_utc)

    usuario = relationship("usuarios", back_populates="empresa_rel")
    estaciones = relationship(
        "EstacionPropia",
        back_populates="empresa",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
