# Backend/models/reserva_model.py
from sqlalchemy import Column, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.config.database import Base
from app.models.utils import generar_uuid, ahora_utc


class Reservas(Base):
    __tablename__ = "reservas"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    estacion_ocm_id = Column(String, nullable=False, index=True)
    cargador_id = Column(String, nullable=True, index=True)
    estacion_nombre = Column(String, default="")
    reservante_nombre = Column(String, nullable=True)
    fecha_hora_inicio = Column(DateTime, nullable=False)
    fecha_hora_fin = Column(DateTime, nullable=False)
    # Importe confirmado en el pago de esta reserva. Se reutiliza al crear la carga.
    costo_pagado = Column(Float, nullable=False, default=0)
    estado = Column(String, default="pendiente")  # pendiente | activa | en_curso | rechazada | realizada | cancelada
    # Momento en que el usuario escaneó el QR del cargador y empezó a cargar.
    iniciada_en = Column(DateTime, nullable=True)
    # NULL = la canceló el usuario o la estación; "no_llego" = no escaneó el QR a tiempo.
    motivo_cancelacion = Column(String, nullable=True)
    created_at = Column(DateTime, default=ahora_utc)

    usuario = relationship("usuarios", back_populates="reservas_rel")
