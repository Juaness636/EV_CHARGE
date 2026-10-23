from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.config.database import Base
from app.models.utils import ahora_utc, generar_uuid


class Compras(Base):
    __tablename__ = "compras"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    producto = Column(String, nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    monto = Column(Float, nullable=False)
    metodo = Column(String(50), nullable=False)
    metodo_id = Column(String, nullable=True)
    transaccion_id = Column(String(40), unique=True, nullable=False, index=True)
    # Estado del pago (siempre "aprobada" en el pago simulado).
    estado = Column(String(20), nullable=False, default="aprobada")
    # Estado logístico que gestiona el administrador: pendiente → confirmado → enviado → entregado (o cancelado).
    estado_pedido = Column(String(20), nullable=False, default="pendiente")
    # Datos de contacto y envío que el comprador indica al pagar.
    contacto_nombre = Column(String, nullable=True)
    contacto_telefono = Column(String(20), nullable=True)
    direccion_envio = Column(String, nullable=True)
    ciudad = Column(String, nullable=True)
    notas_cliente = Column(Text, nullable=True)
    created_at = Column(DateTime, default=ahora_utc, nullable=False)
    updated_at = Column(DateTime, default=ahora_utc, onupdate=ahora_utc, nullable=True)

    usuario = relationship("usuarios")
    mensajes = relationship(
        "MensajeCompra",
        back_populates="compra",
        cascade="all, delete-orphan",
        order_by="MensajeCompra.created_at",
    )


class MensajeCompra(Base):
    """Conversación entre el comprador y el administrador sobre un pedido."""

    __tablename__ = "mensajes_compra"

    id = Column(String, primary_key=True, default=generar_uuid)
    compra_id = Column(String, ForeignKey("compras.id", ondelete="CASCADE"), nullable=False, index=True)
    autor_id = Column(String, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    es_admin = Column(Boolean, nullable=False, default=False)
    texto = Column(Text, nullable=False)
    # Leído por la otra parte (el admin si lo escribió el comprador, y viceversa).
    leido = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=ahora_utc, nullable=False)

    compra = relationship("Compras", back_populates="mensajes")
