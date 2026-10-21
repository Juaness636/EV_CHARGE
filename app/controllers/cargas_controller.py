# Backend/controllers/cargas_controller.py
"""Cargas con ciclo de vida real: en_curso -> completada (Fase 6, opción B).

`registrar_carga_completada` es la única vía del evento "carga completada": la llaman
tanto el cierre de una sesión como la alta manual, así notificar a la empresa ocurre
en un solo lugar y dentro de la misma transacción.
"""

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.controllers.empresa_controller import notificar_empresa
from app.controllers.notificaciones_controller import crear_notificacion
from app.models.carga_model import Cargas
from app.models.cargador_model import Cargador
from app.models.estacion_propia_model import EstacionPropia
from app.models.utils import ahora_utc
from app.schemas.cargas_schema import CargaCreate, CargaFinalizar, CargaIniciar
from app.utils.constantes import (
    CARGADOR_ESTADO_DISPONIBLE,
    ESTADO_CARGA_COMPLETADA,
    ESTADO_CARGA_EN_CURSO,
    ESTADO_ESTACION_ACTIVA,
    TARIFA_KWH_COP,
)


def _carga_a_dict(carga: Cargas) -> dict:
    return {
        "id": carga.id,
        "usuario_id": carga.usuario_id,
        "estacion_ocm_id": carga.estacion_ocm_id,
        "estacion_nombre": carga.estacion_nombre,
        "cargador_id": carga.cargador_id,
        "reserva_id": carga.reserva_id,
        "kwh_cargados": carga.kwh_cargados,
        "costo_estimado": carga.costo_estimado,
        "duracion_min": carga.duracion_min,
        "estado": carga.estado,
        "fecha": carga.fecha,
        "fecha_inicio": carga.fecha_inicio,
        "fecha_fin": carga.fecha_fin,
        "notas": carga.notas,
    }


def registrar_carga_completada(db: Session, carga: Cargas) -> None:
    """Evento 'carga completada' (RN-E09): notifica a la empresa dueña de la estación.

    No commitea: el commit lo hace quien llama, para que la carga y su notificación
    sean atómicos. En estaciones OCM o de EV Charge no hay empresa, así que no pasa nada.
    """
    kwh = carga.kwh_cargados or 0
    notificar_empresa(
        db,
        carga.estacion_ocm_id,
        "Carga completada",
        (
            f"Se completó una carga de {round(kwh, 1)} kWh en {carga.estacion_nombre or 'una de tus estaciones'}"
            + (f" ({carga.duracion_min} min)." if carga.duracion_min else ".")
        ),
        "carga",
    )


def listar_cargas(db: Session, usuario_id: str):
    return (
        db.query(Cargas)
        .filter(Cargas.usuario_id == usuario_id)
        .order_by(Cargas.fecha.desc())
        .all()
    )


def estadisticas_cargas(db: Session, usuario_id: str):
    fila = (
        db.query(
            func.count(Cargas.id),
            func.coalesce(func.sum(Cargas.kwh_cargados), 0.0),
            func.coalesce(func.sum(Cargas.costo_estimado), 0.0),
        )
        .filter(
            Cargas.usuario_id == usuario_id,
            Cargas.estado == ESTADO_CARGA_COMPLETADA,
        )
        .one()
    )
    en_curso = (
        db.query(func.count(Cargas.id))
        .filter(Cargas.usuario_id == usuario_id, Cargas.estado == ESTADO_CARGA_EN_CURSO)
        .scalar()
        or 0
    )
    return {
        "total_sesiones": fila[0],
        "total_kwh": round(float(fila[1]), 2),
        "total_costo": round(float(fila[2]), 0),
        "cargas_en_curso": en_curso,
    }


def _asignar_cargador_libre(db: Session, estacion: EstacionPropia) -> Cargador | None:
    """Sin reserva por cargador (decisión 3.4 = A): se toma el primero disponible."""
    return (
        db.query(Cargador)
        .filter(
            Cargador.estacion_id == estacion.id,
            Cargador.estado == CARGADOR_ESTADO_DISPONIBLE,
        )
        .order_by(Cargador.numero.asc())
        .first()
    )


def iniciar_carga(db: Session, usuario_id: str, data: CargaIniciar):
    estacion = (
        db.query(EstacionPropia)
        .filter(EstacionPropia.id == data.estacion_ocm_id)
        .first()
    )
    if not estacion:
        raise HTTPException(status_code=404, detail="La estación no existe en el sistema.")
    if estacion.estado != ESTADO_ESTACION_ACTIVA or estacion.eliminada:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede cargar: la estación está en estado '{estacion.estado}'.",
        )

    abierta = (
        db.query(Cargas)
        .filter(
            Cargas.usuario_id == usuario_id,
            Cargas.estacion_ocm_id == data.estacion_ocm_id,
            Cargas.estado == ESTADO_CARGA_EN_CURSO,
        )
        .first()
    )
    if abierta:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes una carga en curso en esta estación. Finalízala antes de abrir otra.",
        )

    cargador_id = data.cargador_id
    if cargador_id:
        cargador = (
            db.query(Cargador)
            .filter(Cargador.id == cargador_id, Cargador.estacion_id == estacion.id)
            .first()
        )
        if not cargador:
            raise HTTPException(status_code=404, detail="El cargador no pertenece a esta estación.")
        if cargador.estado != CARGADOR_ESTADO_DISPONIBLE:
            raise HTTPException(status_code=400, detail="Ese cargador está fuera de servicio.")
    else:
        libre = _asignar_cargador_libre(db, estacion)
        cargador_id = libre.id if libre else None

    ahora = ahora_utc()
    carga = Cargas(
        usuario_id=usuario_id,
        estacion_ocm_id=data.estacion_ocm_id,
        estacion_nombre=estacion.nombre,
        cargador_id=cargador_id,
        reserva_id=data.reserva_id,
        estado=ESTADO_CARGA_EN_CURSO,
        fecha=ahora,
        fecha_inicio=ahora,
        notas=data.notas or "",
    )
    db.add(carga)
    db.commit()
    db.refresh(carga)
    return _carga_a_dict(carga)


def finalizar_carga(db: Session, usuario_id: str, carga_id: str, data: CargaFinalizar):
    carga = (
        db.query(Cargas)
        .filter(Cargas.id == carga_id, Cargas.usuario_id == usuario_id)
        .first()
    )
    if not carga:
        raise HTTPException(status_code=404, detail="Carga no encontrada.")
    if carga.estado != ESTADO_CARGA_EN_CURSO:
        raise HTTPException(status_code=400, detail="Esta carga ya fue finalizada.")

    ahora = ahora_utc()
    duracion = data.duracion_min
    if duracion is None and carga.fecha_inicio:
        inicio = carga.fecha_inicio
        if inicio.tzinfo is None:
            # ahora_utc() guarda aware; si la BD devuelve naive se asume UTC.
            from datetime import timezone

            inicio = inicio.replace(tzinfo=timezone.utc)
        duracion = max(1, int((ahora - inicio).total_seconds() // 60))

    carga.kwh_cargados = data.kwh_cargados
    carga.duracion_min = duracion
    carga.costo_estimado = (
        round(data.costo_estimado, 0)
        if data.costo_estimado is not None
        else round(data.kwh_cargados * TARIFA_KWH_COP, 0)
    )
    if data.notas:
        carga.notas = data.notas
    carga.fecha_fin = ahora
    carga.estado = ESTADO_CARGA_COMPLETADA

    registrar_carga_completada(db, carga)
    crear_notificacion(
        db,
        usuario_id,
        "Carga finalizada",
        (
            f"Registraste {round(data.kwh_cargados, 1)} kWh en {carga.estacion_nombre or 'la estación'}"
            + (f" durante {duracion} min." if duracion else ".")
        ),
        "carga",
    )
    db.commit()
    db.refresh(carga)
    return _carga_a_dict(carga)


def cancelar_carga_en_curso(db: Session, usuario_id: str, carga_id: str):
    """Cierra una sesión sin datos de consumo: no debe contaminar las estadísticas."""
    carga = (
        db.query(Cargas)
        .filter(Cargas.id == carga_id, Cargas.usuario_id == usuario_id)
        .first()
    )
    if not carga:
        raise HTTPException(status_code=404, detail="Carga no encontrada.")
    if carga.estado != ESTADO_CARGA_EN_CURSO:
        raise HTTPException(status_code=400, detail="Solo se puede cancelar una carga en curso.")

    db.delete(carga)
    db.commit()
    return {"ok": True}


def descartar_sesion_de_reserva(db: Session, reserva_id: str) -> None:
    """La reserva cancelada (RN-E06) no puede dejar una sesión `en_curso` huérfana.

    Va sin commit: quien llama cierra la transacción junto con la reserva.
    """
    for carga in (
        db.query(Cargas)
        .filter(Cargas.reserva_id == reserva_id, Cargas.estado == ESTADO_CARGA_EN_CURSO)
        .all()
    ):
        db.delete(carga)


def crear_carga(db: Session, usuario_id: str, data: CargaCreate):
    """Alta manual: la carga nace ya completada (lo hacía el usuario antes de este módulo)."""
    costo = (
        round(data.costo_estimado, 0)
        if data.costo_estimado is not None
        else round(data.kwh_cargados * TARIFA_KWH_COP, 0)
    )
    ahora = ahora_utc()
    carga = Cargas(
        usuario_id=usuario_id,
        estacion_ocm_id=data.estacion_ocm_id,
        estacion_nombre=data.estacion_nombre or "",
        cargador_id=data.cargador_id,
        kwh_cargados=data.kwh_cargados,
        costo_estimado=costo,
        duracion_min=data.duracion_min,
        estado=ESTADO_CARGA_COMPLETADA,
        fecha=ahora,
        fecha_fin=ahora,
        notas=data.notas or "",
    )
    if data.cargador_id:
        cargador = db.query(Cargador).filter(Cargador.id == data.cargador_id).first()
        if not cargador:
            raise HTTPException(status_code=404, detail="El cargador indicado no existe.")
    db.add(carga)
    registrar_carga_completada(db, carga)
    db.commit()
    db.refresh(carga)
    return _carga_a_dict(carga)
