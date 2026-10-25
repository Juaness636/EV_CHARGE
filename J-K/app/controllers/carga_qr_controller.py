# Backend/controllers/carga_qr_controller.py
"""Inicio de la carga con el QR del cargador, fin de la carga y vencimiento de reservas.

Flujo: el usuario paga su reserva (queda "activa"), llega a la estación y escanea el QR
del cargador. Si el QR es del cargador que reservó y está dentro de su franja, la reserva
pasa a "en_curso" y el mapa muestra ese cargador en uso. Si no escanea dentro de los 30
minutos siguientes a la hora programada, la reserva se cancela sola y el cargador se libera.

Las horas se comparan en PostgreSQL (`now()`), igual que el resto del backend: las columnas
guardan la hora sin zona en la zona de la sesión de la base de datos.
"""

import logging
import threading
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config.database import SessionLocal
from app.controllers.empresa_controller import notificar_empresa
from app.controllers.empresa_estaciones_controller import cargador_por_referencia, cargadores_de
from app.controllers.notificaciones_controller import crear_notificacion
from app.models.estacion_propia_model import EstacionPropia
from app.models.reserva_model import Reservas
from app.models.utils import ahora_utc
from app.services.carga_reserva import registrar_carga_de_reserva
from app.services.qr_service import cargadores_estacion, codigo_cargador, leer_qr
from app.utils.constantes import (
    ESTADO_RESERVA_ACTIVA,
    ESTADO_RESERVA_CANCELADA,
    ESTADO_RESERVA_EN_CURSO,
    ESTADO_RESERVA_REALIZADA,
    MINUTOS_ANTICIPACION_QR,
    MINUTOS_TOLERANCIA_LLEGADA,
    MOTIVO_CANCELACION_NO_LLEGO,
)
from app.utils.rate_limit import LimiteIntentos

log = logging.getLogger(__name__)

# 10 lecturas cada 5 minutos por usuario: suficiente para reintentar, inútil para adivinar códigos.
_limite_escaneos = LimiteIntentos(maximo=10, ventana_segundos=300)
SEGUNDOS_ENTRE_REVISIONES = 30


def _nombre(reserva: Reservas) -> str:
    return reserva.estacion_nombre or reserva.estacion_ocm_id


def _numero_cargador(db: Session, estacion_id: str, referencia: str) -> int | None:
    """Número visible (#1, #2...) del cargador que nombra una referencia."""
    propia = db.query(EstacionPropia.id).filter(EstacionPropia.id == estacion_id).first()
    if propia:
        for posicion, cargador in enumerate(cargadores_de(db, estacion_id), start=1):
            if referencia in (cargador.id, f"{estacion_id}-{posicion}"):
                return posicion
        return None
    final = referencia.rsplit("-", 1)[-1]
    return int(final) if final.isdigit() else None


def _referencias_validas(db: Session, reserva: Reservas) -> list[str]:
    """Referencias (las que firma el QR) de los cargadores con los que puede iniciar esta reserva."""
    estacion_id = reserva.estacion_ocm_id
    cargador_id = reserva.cargador_id or f"{estacion_id}-general"
    if cargador_id.endswith("-general"):
        # Reserva sin cargador concreto: sirve cualquier cargador de la estación.
        return [c["referencia"] for c in cargadores_estacion(db, estacion_id)["cargadores"]]
    if db.query(EstacionPropia.id).filter(EstacionPropia.id == estacion_id).first():
        cargador = cargador_por_referencia(db, estacion_id, cargador_id)
        return [cargador.id] if cargador else [cargador_id]
    return [cargador_id]


def _segundos_para_inicio(db: Session, reserva: Reservas) -> float:
    valor = db.query(func.extract("epoch", Reservas.fecha_hora_inicio - func.now())).filter(Reservas.id == reserva.id).scalar()
    return float(valor or 0)


def _cancelar_por_no_llegar(db: Session, reserva: Reservas) -> None:
    """Cancela sin reembolso: el pago queda usado y el cargador vuelve a estar libre. No commitea."""
    reserva.estado = ESTADO_RESERVA_CANCELADA
    reserva.motivo_cancelacion = MOTIVO_CANCELACION_NO_LLEGO
    hora = reserva.fecha_hora_inicio.strftime("%H:%M")
    crear_notificacion(
        db,
        reserva.usuario_id,
        "Reserva cancelada por no llegar",
        f"No escaneaste el QR del cargador en {_nombre(reserva)} dentro de los {MINUTOS_TOLERANCIA_LLEGADA} minutos "
        f"siguientes a tu reserva de las {hora}. El cargador quedó libre para otros conductores y, como no se usó "
        "a tiempo, esta cancelación no tiene reembolso.",
        "reserva",
    )
    notificar_empresa(
        db,
        reserva.estacion_ocm_id,
        "Reserva vencida",
        f"La reserva de las {hora} en {_nombre(reserva)} se canceló porque el usuario no llegó. El cargador quedó libre.",
        "reserva",
    )


def _finalizar(db: Session, reserva: Reservas, horas: float, mensaje: str) -> None:
    reserva.estado = ESTADO_RESERVA_REALIZADA
    registrar_carga_de_reserva(db, reserva, horas, mensaje)
    notificar_empresa(db, reserva.estacion_ocm_id, "Carga finalizada", f"Terminó una carga en {_nombre(reserva)}.", "reserva")


def escanear_qr(db: Session, usuario_id: str, rid: str, codigo: str) -> dict:
    if not _limite_escaneos.consumir(f"qr:{usuario_id}"):
        raise HTTPException(status_code=429, detail="Hiciste demasiados intentos de escaneo. Espera unos minutos e inténtalo de nuevo.")

    reserva = (
        db.query(Reservas)
        .filter(Reservas.id == rid, Reservas.usuario_id == usuario_id)
        .with_for_update()
        .first()
    )
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado == ESTADO_RESERVA_EN_CURSO:
        return {"ok": True, "mensaje": "Tu carga ya está en curso. ¡Puedes usar el cargador!", "reserva": reserva}
    if reserva.estado == ESTADO_RESERVA_CANCELADA and reserva.motivo_cancelacion == MOTIVO_CANCELACION_NO_LLEGO:
        raise HTTPException(
            status_code=400,
            detail=f"Esta reserva se canceló porque pasaron más de {MINUTOS_TOLERANCIA_LLEGADA} minutos sin escanear el QR. Haz una nueva reserva.",
        )
    if reserva.estado == "pendiente":
        raise HTTPException(status_code=400, detail="Tu reserva todavía no está confirmada. Espera la aprobación antes de escanear el QR.")
    if reserva.estado != ESTADO_RESERVA_ACTIVA:
        raise HTTPException(status_code=400, detail="Esta reserva ya no está activa, así que no puede iniciar una carga.")

    faltan = _segundos_para_inicio(db, reserva)
    if faltan > MINUTOS_ANTICIPACION_QR * 60:
        desde = (reserva.fecha_hora_inicio - timedelta(minutes=MINUTOS_ANTICIPACION_QR)).strftime("%d/%m %H:%M")
        raise HTTPException(
            status_code=400,
            detail=f"Todavía es temprano: podrás escanear el QR desde las {desde} ({MINUTOS_ANTICIPACION_QR} minutos antes de tu reserva).",
        )
    if faltan < -MINUTOS_TOLERANCIA_LLEGADA * 60:
        _cancelar_por_no_llegar(db, reserva)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Llegaste tarde: pasaron más de {MINUTOS_TOLERANCIA_LLEGADA} minutos desde la hora de tu reserva y se canceló. El cargador quedó libre.",
        )

    lectura = leer_qr(codigo)
    estacion_id = reserva.estacion_ocm_id
    validas = _referencias_validas(db, reserva)
    numero_reservado = _numero_cargador(db, estacion_id, validas[0]) if len(validas) == 1 else None
    tu_cargador = f"el cargador #{numero_reservado}" if numero_reservado else "el cargador que reservaste"
    al_cargador = "al" + tu_cargador[2:]
    if "estacion_id" in lectura:
        if lectura["estacion_id"] != estacion_id:
            raise HTTPException(status_code=400, detail=f"Este QR es de otra estación. Tu reserva es en {_nombre(reserva)}.")
        if lectura["referencia"] not in validas:
            escaneado = _numero_cargador(db, estacion_id, lectura["referencia"])
            raise HTTPException(
                status_code=400,
                detail=f"Este QR es del cargador #{escaneado}, no del tuyo. Busca {tu_cargador} en la estación." if escaneado
                else f"Este QR no es de tu cargador. Busca {tu_cargador} en la estación.",
            )
    elif lectura["codigo"] not in {codigo_cargador(estacion_id, ref) for ref in validas}:
        raise HTTPException(status_code=400, detail=f"El código no corresponde {al_cargador}. Revisa que lo escribiste bien.")

    reserva.estado = ESTADO_RESERVA_EN_CURSO
    reserva.iniciada_en = ahora_utc()
    crear_notificacion(db, usuario_id, "Carga iniciada", f"Desbloqueaste {tu_cargador} en {_nombre(reserva)}. ¡Buena carga!", "carga")
    notificar_empresa(db, estacion_id, "Carga iniciada", f"Un usuario empezó a cargar en {_nombre(reserva)}.", "reserva")
    db.commit()
    db.refresh(reserva)
    return {"ok": True, "mensaje": f"¡Listo! Desbloqueaste {tu_cargador}. Ya puedes conectar tu vehículo.", "reserva": reserva}


def terminar_carga(db: Session, usuario_id: str, rid: str) -> dict:
    reserva = (
        db.query(Reservas)
        .filter(Reservas.id == rid, Reservas.usuario_id == usuario_id)
        .with_for_update()
        .first()
    )
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if reserva.estado != ESTADO_RESERVA_EN_CURSO:
        raise HTTPException(status_code=400, detail="Esta reserva no tiene una carga en curso.")
    segundos = db.query(func.extract("epoch", func.now() - Reservas.iniciada_en)).filter(Reservas.id == rid).scalar()
    _finalizar(db, reserva, float(segundos or 0) / 3600, f"Terminaste tu carga en {_nombre(reserva)}. Quedó registrada en tu historial.")
    db.commit()
    db.refresh(reserva)
    return {"ok": True, "mensaje": "Carga terminada. El cargador quedó libre para otros conductores.", "reserva": reserva}


def procesar_vencimientos(db: Session) -> dict:
    """Cancela las reservas sin llegada y cierra las cargas cuyo horario terminó."""
    limite = ahora_utc() - timedelta(minutes=MINUTOS_TOLERANCIA_LLEGADA)
    sin_llegada = (
        db.query(Reservas)
        .filter(Reservas.estado == ESTADO_RESERVA_ACTIVA, Reservas.fecha_hora_inicio < limite)
        .with_for_update(skip_locked=True)
        .all()
    )
    for reserva in sin_llegada:
        _cancelar_por_no_llegar(db, reserva)

    terminadas = (
        db.query(Reservas)
        .filter(Reservas.estado == ESTADO_RESERVA_EN_CURSO, Reservas.fecha_hora_fin < ahora_utc())
        .with_for_update(skip_locked=True)
        .all()
    )
    for reserva in terminadas:
        horas = (reserva.fecha_hora_fin - (reserva.iniciada_en or reserva.fecha_hora_inicio)).total_seconds() / 3600
        _finalizar(db, reserva, horas, f"Tu carga en {_nombre(reserva)} terminó al cumplirse el horario reservado.")
    db.commit()
    return {"canceladas": len(sin_llegada), "finalizadas": len(terminadas)}


_revisor_iniciado = threading.Event()


def iniciar_revisor_vencimientos() -> None:
    """Hilo de fondo que revisa los vencimientos cada 30 segundos (una vez por proceso)."""
    if _revisor_iniciado.is_set():
        return
    _revisor_iniciado.set()

    def ciclo():
        while True:
            try:
                with SessionLocal() as db:
                    resultado = procesar_vencimientos(db)
                if resultado["canceladas"] or resultado["finalizadas"]:
                    log.info("Reservas vencidas: %s", resultado)
            except Exception:  # noqa: BLE001 - el hilo nunca debe morir por un error puntual
                log.exception("No se pudieron revisar las reservas vencidas")
            threading.Event().wait(SEGUNDOS_ENTRE_REVISIONES)

    threading.Thread(target=ciclo, name="revisor-reservas", daemon=True).start()
