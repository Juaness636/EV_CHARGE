from sqlalchemy import Column, DateTime, Float, ForeignKey, String

from app.config.database import Base
from app.models.utils import ahora_utc, generar_uuid


class PagosReserva(Base):
    """Pago aprobado por el servidor para una reserva. Cada pago confirma una sola reserva."""

    __tablename__ = "pagos_reserva"

    id = Column(String, primary_key=True, default=generar_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    transaccion_id = Column(String(40), unique=True, nullable=False, index=True)
    monto = Column(Float, nullable=False)
    metodo = Column(String(50), nullable=False)
    metodo_id = Column(String, nullable=True)
    # aprobado (sin usar) | usado (ya confirmó una reserva) | reembolsado
    estado = Column(String(20), nullable=False, default="aprobado")
    reserva_id = Column(String, ForeignKey("reservas.id", ondelete="SET NULL"), nullable=True, unique=True)
    created_at = Column(DateTime, default=ahora_utc, nullable=False)
