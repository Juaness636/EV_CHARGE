# Backend/controllers/reservas_controller.py
from datetime import timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.reserva_model import Reservas
from app.models.estacion_propia_model import EstacionPropia
from app.models.estado_estacion_model import EstadoEstacion
from app.models.usuario_model import usuarios
from app.models.pago_reserva_model import PagosReserva
from app.models.utils import ahora_utc
from app.schemas.reservas_schemas import ReservaCreate, ReservaConfirmadaCreate, ReservaUpdate
from app.controllers.notificaciones_controller import crear_notificacion
from app.controllers.empresa_controller import notificar_empresa
from app.controllers.empresa_estaciones_controller import cargador_por_referencia
from app.utils.constantes import CARGADOR_ESTADO_DISPONIBLE, EMPRESA_APROBADA, ESTADO_RESERVA_EN_CURSO, ESTADOS_RESERVA_OCUPAN


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


def utc_sin_zona(dt):
    """Fecha en UTC sin zona horaria, como se guardan en las columnas DateTime."""
    return _aware(dt).astimezone(timezone.utc).replace(tzinfo=None)


def validar_reserva(db: Session, usuario_id: str, data: ReservaCreate) -> str:
    """Comprueba que la reserva se puede hacer y devuelve el cargador_id normalizado.

    Se llama antes de cobrar (para no aprobar pagos de reservas imposibles) y otra vez
    al crear la reserva, porque entre ambos pasos otro usuario pudo ocupar el cargador.
    """
    if _aware(data.fecha_hora_inicio) >= _aware(data.fecha_hora_fin):
        raise HTTPException(status_code=400, detail="Inicio debe ser anterior a Fin")
    if _aware(data.fecha_hora_inicio) < ahora_utc():
        raise HTTPException(status_code=400, detail="No se puede reservar en el pasado")

    estado_externo = db.query(EstadoEstacion).filter(EstadoEstacion.estacion_ocm_id == data.estacion_ocm_id).first()
    estacion_propia = db.query(EstacionPropia).filter(EstacionPropia.id == data.estacion_ocm_id).first()
    estado_estacion = estado_externo.estado if estado_externo else (estacion_propia.estado if estacion_propia else "activa")
    if estado_estacion in {"mantenimiento", "inactiva"}:
        raise HTTPException(status_code=400, detail="Esta estación no está disponible para reservar")
    if estacion_propia and (estacion_propia.eliminada or (estacion_propia.empresa and estacion_propia.empresa.estado != EMPRESA_APROBADA)):
        raise HTTPException(status_code=400, detail="Esta estación no está disponible para reservar")
    if estacion_propia and data.cargador_id:
        cargador = cargador_por_referencia(db, estacion_propia.id, data.cargador_id)
        if cargador and cargador.estado != CARGADOR_ESTADO_DISPONIBLE:
            raise HTTPException(status_code=400, detail="Este cargador está fuera de servicio")

    cargador_id = data.cargador_id or f"{data.estacion_ocm_id}-general"
    existente = db.query(Reservas).filter(
        Reservas.usuario_id == usuario_id,
        Reservas.estacion_ocm_id == data.estacion_ocm_id,
        Reservas.cargador_id == cargador_id,
        Reservas.fecha_hora_inicio == data.fecha_hora_inicio,
        Reservas.fecha_hora_fin == data.fecha_hora_fin,
        Reservas.estado.in_(("pendiente", "activa")),
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya tienes una reserva activa para este cargador en ese horario")

    solapada = db.query(Reservas).filter(
        Reservas.estacion_ocm_id == data.estacion_ocm_id,
        Reservas.cargador_id == cargador_id,
        Reservas.estado.in_(ESTADOS_RESERVA_OCUPAN),
        Reservas.fecha_hora_inicio < data.fecha_hora_fin,
        Reservas.fecha_hora_fin > data.fecha_hora_inicio,
        Reservas.usuario_id != usuario_id,
    ).first()
    if solapada:
        # Respeta la preferencia de privacidad del otro usuario (compartir_nombre_reserva).
        nombre = solapada.reservante_nombre or "otro usuario"
        raise HTTPException(
            status_code=400,
            detail=f"Cargador ya reservado por {nombre} de {solapada.fecha_hora_inicio.strftime('%H:%M')} a {solapada.fecha_hora_fin.strftime('%H:%M')}",
        )
    return cargador_id


def _bloquear_cargador(db: Session, data: ReservaCreate) -> None:
    """Serializa las reservas del mismo cargador hasta el commit (evita la doble reserva
    cuando dos personas confirman al mismo tiempo). Solo aplica en PostgreSQL."""
    if db.get_bind().dialect.name != "postgresql":
        return
    clave = f"reserva:{data.estacion_ocm_id}:{data.cargador_id or 'general'}"
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:clave))"), {"clave": clave})


def crear_reserva(db: Session, usuario_id: str, data: ReservaCreate, estado: str = "pendiente", pago: PagosReserva | None = None):
    if estado not in {"pendiente", "activa"}:
        raise HTTPException(status_code=400, detail="Estado de reserva no válido")
    # Una reserva solo queda activa si viene respaldada por un pago verificado.
    if estado == "activa" and pago is None:
        raise HTTPException(status_code=402, detail="La reserva requiere un pago aprobado")
    _bloquear_cargador(db, data)
    cargador_id = validar_reserva(db, usuario_id, data)

    datos = data.model_dump(include=set(ReservaCreate.model_fields))
    datos["cargador_id"] = cargador_id
    datos["estado"] = estado
    # El importe sale del pago registrado en el servidor, nunca del cliente.
    datos["costo_pagado"] = float(pago.monto) if pago else 0
    usuario = db.query(usuarios).filter(usuarios.id == usuario_id).first()
    datos["reservante_nombre"] = _nombre_completo(usuario) if usuario and usuario.compartir_nombre_reserva else "Usuario EV Charge"
    reserva = Reservas(usuario_id=usuario_id, **datos)
    db.add(reserva)
    if pago:
        db.flush()
        pago.estado = "usado"
        pago.reserva_id = reserva.id
    crear_notificacion(
        db,
        usuario_id,
        "Reserva aceptada" if estado == "activa" else "Solicitud de reserva recibida",
        f"Tu reserva de {data.estacion_nombre or data.estacion_ocm_id} fue aceptada después del pago." if estado == "activa" else f"Recibimos tu solicitud para {data.estacion_nombre or data.estacion_ocm_id}. Está pendiente de revisión por el administrador.",
        "reserva",
    )
    notificar_empresa(
        db,
        data.estacion_ocm_id,
        "Nueva reserva",
        f"Se registró una reserva en {data.estacion_nombre or data.estacion_ocm_id} "
        f"para el {data.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M')}.",
        "reserva",
    )
    db.commit()
    db.refresh(reserva)
    return reserva


def crear_reserva_confirmada(db: Session, usuario_id: str, data: ReservaConfirmadaCreate):
    pago = (
        db.query(PagosReserva)
        .filter(
            PagosReserva.transaccion_id == data.transaccion_id,
            PagosReserva.usuario_id == usuario_id,
        )
        .with_for_update()
        .first()
    )
    if not pago:
        raise HTTPException(status_code=402, detail="No encontramos un pago aprobado para esta reserva")
    if pago.estado != "aprobado" or pago.reserva_id:
        raise HTTPException(status_code=409, detail="Este pago ya se usó para otra reserva")
    # El pago cubre exactamente la estación, el cargador y el horario que se cotizaron:
    # no sirve para reservar más horas ni un cargador más caro.
    cargador_id = data.cargador_id or f"{data.estacion_ocm_id}-general"
    if (
        not pago.estacion_ocm_id
        or pago.estacion_ocm_id != data.estacion_ocm_id
        or pago.cargador_id != cargador_id
        or not _mismo_instante(pago.fecha_hora_inicio, data.fecha_hora_inicio)
        or not _mismo_instante(pago.fecha_hora_fin, data.fecha_hora_fin)
    ):
        raise HTTPException(status_code=409, detail="Los datos de la reserva no coinciden con el pago realizado")
    return crear_reserva(db, usuario_id, data, estado="activa", pago=pago)


def _mismo_instante(guardado, recibido) -> bool:
    if guardado is None:
        return False
    return abs((utc_sin_zona(guardado) - utc_sin_zona(recibido)).total_seconds()) < 1


def actualizar_reserva(db: Session, usuario_id: str, rid: str, data: ReservaUpdate):
    reserva = db.query(Reservas).filter(Reservas.id == rid, Reservas.usuario_id == usuario_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Solo se pueden editar solicitudes pendientes")

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
    cargador_id = datos.get("cargador_id") or reserva.cargador_id or f"{estacion_id}-general"
    if not estacion_id:
        raise HTTPException(status_code=400, detail="La estación es obligatoria")

    solapada = (
        db.query(Reservas)
        .filter(
            Reservas.id != rid,
            Reservas.estacion_ocm_id == estacion_id,
            Reservas.cargador_id == cargador_id,
            Reservas.estado.in_(ESTADOS_RESERVA_OCUPAN),
            Reservas.fecha_hora_inicio < fin,
            Reservas.fecha_hora_fin > inicio,
            Reservas.usuario_id != usuario_id,
        )
        .first()
    )
    if solapada:
        # Respeta la preferencia de privacidad del otro usuario (compartir_nombre_reserva).
        nombre = solapada.reservante_nombre or "otro usuario"
        raise HTTPException(
            status_code=400,
            detail=f"Cargador ya reservado por {nombre} de {solapada.fecha_hora_inicio.strftime('%H:%M')} a {solapada.fecha_hora_fin.strftime('%H:%M')}",
        )

    for key, value in datos.items():
        setattr(reserva, key, value)
    reserva.cargador_id = cargador_id

    crear_notificacion(db, usuario_id, "Reserva actualizada", f"Actualizaste tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id}.", "reserva")
    db.commit()
    db.refresh(reserva)
    return reserva


def cancelar_reserva(db: Session, usuario_id: str, rid: str):
    reserva = db.query(Reservas).filter(Reservas.id == rid, Reservas.usuario_id == usuario_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado == ESTADO_RESERVA_EN_CURSO:
        raise HTTPException(status_code=400, detail="Tu carga ya empezó. Usa \"Terminar carga\" cuando desconectes el vehículo.")
    if reserva.estado in {"realizada", "cancelada", "rechazada"}:
        raise HTTPException(status_code=400, detail="Esta reserva ya no se puede cancelar")
    monto_reembolsado = float(reserva.costo_pagado or 0)
    reserva.estado = "cancelada"
    # El pago de la reserva es simulado dentro de EV Charge. Al cancelar,
    # se revierte el importe para que no siga apareciendo como gasto acumulado.
    reserva.costo_pagado = 0
    pago = db.query(PagosReserva).filter(PagosReserva.reserva_id == reserva.id).first()
    if pago:
        pago.estado = "reembolsado"
    detalle_reembolso = f" Se devolvieron ${monto_reembolsado:,.0f} COP." if monto_reembolsado > 0 else " No había un pago asociado para devolver."
    crear_notificacion(db, usuario_id, "Reserva cancelada", f"Cancelaste tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id}.", "reserva")
    db.commit()
    return {"ok": True, "reembolso": monto_reembolsado, "mensaje": f"Reserva cancelada correctamente.{detalle_reembolso}"}


def eliminar_reserva(db: Session, usuario_id: str, rid: str):
    reserva = db.query(Reservas).filter(Reservas.id == rid, Reservas.usuario_id == usuario_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reserva.estado != "realizada":
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar reservas realizadas")
    db.delete(reserva)
    crear_notificacion(db, usuario_id, "Reserva eliminada", f"Eliminaste tu reserva de {reserva.estacion_nombre or reserva.estacion_ocm_id}.", "reserva")
    db.commit()
    return {"ok": True}
