# Backend/controllers/reservas_controller.py
import random
from datetime import timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.reserva_model import Reservas
from app.models.carga_model import Cargas
from app.models.utils import ahora_utc
from app.schemas.reservas_schemas import ReservaCreate, ReservaUpdate
from app.controllers.notificaciones_controller import crear_notificacion


def _aware(dt):
    """Si el datetime viene sin zona horaria (naive), se asume UTC para poder compararlo
    con seguridad. Evita el error 'can't compare offset-naive and offset-aware datetime'
    cuando el frontend manda fechas sin sufijo de timezone (ej: '2026-08-20T10:00:00')."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _nombre_completo(usuario) -> str:
    if not usuario:
        return "Usuario eliminado"
    if usuario.apellido and usuario.apellido.strip():
        return f"{usuario.nombre} {usuario.apellido}"
    return usuario.nombre


def listar_mis_reservas(db: Session, usuario_id: str):
    return (
        db.query(Reservas)
        .filter(Reservas.usuario_id == usuario_id)
        .order_by(Reservas.fecha_hora_inicio.asc())
        .all()
    )


def crear_reserva(db: Session, usuario_id: str, data: ReservaCreate):
    if _aware(data.fecha_hora_inicio) >= _aware(data.fecha_hora_fin):
        raise HTTPException(status_code=400, detail="Inicio debe ser anterior a Fin")
    if _aware(data.fecha_hora_inicio) < ahora_utc():
        raise HTTPException(status_code=400, detail="No se puede reservar en el pasado")

    existente = db.query(Reservas).filter(
        Reservas.usuario_id == usuario_id,
        Reservas.estacion_ocm_id == data.estacion_ocm_id,
        Reservas.fecha_hora_inicio == data.fecha_hora_inicio,
        Reservas.fecha_hora_fin == data.fecha_hora_fin,
        Reservas.estado == "activa",
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya tienes una reserva activa para esta estación en ese horario")

    solapada = db.query(Reservas).filter(
        Reservas.estacion_ocm_id == data.estacion_ocm_id,
        Reservas.estado == "activa",
        Reservas.fecha_hora_inicio < data.fecha_hora_fin,
        Reservas.fecha_hora_fin > data.fecha_hora_inicio,
        Reservas.usuario_id != usuario_id,
    ).first()
    if solapada:
        nombre = _nombre_completo(solapada.usuario)
        raise HTTPException(
            status_code=400,
            detail=f"Estación ya reservada por {nombre} de {solapada.fecha_hora_inicio.strftime('%H:%M')} a {solapada.fecha_hora_fin.strftime('%H:%M')}",
        )

    reserva = Reservas(usuario_id=usuario_id, **data.model_dump())
    db.add(reserva)
    crear_notificacion(
        db,
        usuario_id,
        "Reserva creada",
        f"Reservaste {data.estacion_nombre or data.estacion_ocm_id} para el {data.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')}.",
        "reserva",
    )
    db.commit()
    db.refresh(reserva)

    kwh = round(random.uniform(10.0, 30.0), 1)
    costo = round(kwh * 1200, 0)
    carga_auto = Cargas(
        usuario_id=usuario_id,
        estacion_ocm_id=data.estacion_ocm_id,
        estacion_nombre=data.estacion_nombre or "Estación desconocida",
        kwh_cargados=kwh,
        costo_estimado=costo,
        notas=f"Carga automática por reserva del {ahora_utc().strftime('%d/%m/%Y %H:%M')}",
    )
    db.add(carga_auto)
    db.commit()
    return reserva


def actualizar_reserva(db: Session, usuario_id: str, rid: str, data: ReservaUpdate):
    reserva = db.query(Reservas).filter(Reservas.id == rid, Reservas.usuario_id == usuario_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado == "cancelada":
        raise HTTPException(status_code=400, detail="No se puede editar una reserva cancelada")

    datos = data.model_dump(exclude_unset=True)
    if not datos:
        return reserva

    inicio = datos.get("fecha_hora_inicio") or reserva.fecha_hora_inicio
    fin = datos.get("fecha_hora_fin") or reserva.fecha_hora_fin

    if _aware(inicio) >= _aware(fin):
        raise HTTPException(status_code=400, detail="Inicio debe ser anterior a Fin")

    if _aware(inicio) < ahora_utc():
        raise HTTPException(status_code=400, detail="No se puede reservar en el pasado")

    estacion_id = datos.get("estacion_ocm_id") or reserva.estacion_ocm_id
    if not estacion_id:
        raise HTTPException(status_code=400, detail="La estación es obligatoria")

    solapada = (
        db.query(Reservas)
        .filter(
            Reservas.id != rid,
            Reservas.estacion_ocm_id == estacion_id,
            Reservas.estado == "activa",
            Reservas.fecha_hora_inicio < fin,
            Reservas.fecha_hora_fin > inicio,
            Reservas.usuario_id != usuario_id,
        )
        .first()
    )
    if solapada:
        nombre = _nombre_completo(solapada.usuario)
        raise HTTPException(
            status_code=400,
            detail=f"Estación ya reservada por {nombre} de {solapada.fecha_hora_inicio.strftime('%H:%M')} a {solapada.fecha_hora_fin.strftime('%H:%M')}",
        )

    for key, value in datos.items():
        setattr(reserva, key, value)

    crear_notificacion(db, usuario_id, "Reserva actualizada", f"Actualizaste tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id}.", "reserva")
    db.commit()
    db.refresh(reserva)
    return reserva


def cancelar_reserva(db: Session, usuario_id: str, rid: str):
    reserva = db.query(Reservas).filter(Reservas.id == rid, Reservas.usuario_id == usuario_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    reserva.estado = "cancelada"
    crear_notificacion(db, usuario_id, "Reserva cancelada", f"Cancelaste tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id}.", "reserva")
    db.commit()
    return {"ok": True}


def eliminar_reserva(db: Session, usuario_id: str, rid: str):
    reserva = db.query(Reservas).filter(Reservas.id == rid, Reservas.usuario_id == usuario_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    db.delete(reserva)
    crear_notificacion(db, usuario_id, "Reserva eliminada", f"Eliminaste tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id}.", "reserva")
    db.commit()
    return {"ok": True}