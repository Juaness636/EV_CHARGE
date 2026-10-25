# Backend/services/carga_reserva.py
"""Carga validada que deja una reserva al terminar (la usan el admin y la carga con QR)."""

from sqlalchemy.orm import Session

from app.controllers.notificaciones_controller import crear_notificacion
from app.models.carga_model import Cargas
from app.models.reserva_model import Reservas

# Potencia promedio simulada de una carga AC (kW) para estimar los kWh entregados.
KW_SIMULADOS = 7.4


def registrar_carga_de_reserva(db: Session, reserva: Reservas, duracion_horas: float, mensaje: str) -> None:
    """Crea la carga validada de la reserva una sola vez. No commitea."""
    referencia = f"Carga generada desde la reserva {reserva.id}"
    if db.query(Cargas).filter(Cargas.notas == referencia).first():
        return
    duracion_horas = max(0, duracion_horas)
    db.add(Cargas(
        usuario_id=reserva.usuario_id,
        estacion_ocm_id=reserva.estacion_ocm_id,
        cargador_id=reserva.cargador_id,
        estacion_nombre=reserva.estacion_nombre or "",
        kwh_cargados=round(duracion_horas * KW_SIMULADOS, 2),
        # Conserva el valor que el usuario aprobó al pagar su reserva.
        costo_estimado=reserva.costo_pagado or max(1, round(duracion_horas)) * 5000,
        notas=referencia,
        estado="validada",
    ))
    crear_notificacion(db, reserva.usuario_id, "Carga validada", mensaje, "carga")
