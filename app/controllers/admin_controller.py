# Backend/controllers/admin_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.usuario_model import usuarios
from app.models.vehiculo_model import vehiculos
from app.models.reserva_model import Reservas
from app.models.carga_model import Cargas
from app.models.reporte_model import Reportes
from app.models.calificacion_model import Calificaciones
from app.models.estacion_propia_model import EstacionPropia
from app.schemas.admin_schema import EstacionPropiaCreate, EstadoUpdate, AdminReservaUpdate


def listar_usuarios(db: Session):
    return db.query(usuarios).all()


def obtener_estadisticas(db: Session):
    cargas = db.query(Cargas).all()
    return {
        "total_usuarios": db.query(usuarios).count(),
        "total_vehiculos": db.query(vehiculos).count(),
        "total_reservas_activas": db.query(Reservas).filter(Reservas.estado == "activa").count(),
        "total_cargas": len(cargas),
        "total_kwh_cargados": sum(c.kwh_cargados for c in cargas) if cargas else 0.0,
        "total_reportes_abiertos": db.query(Reportes).filter(Reportes.estado == "abierto").count(),
        "total_estaciones_propias": db.query(EstacionPropia).count(),
    }


def listar_reportes(db: Session):
    return db.query(Reportes).all()


def resolver_reporte(rid: str, db: Session):
    reporte = db.query(Reportes).filter(Reportes.id == rid).first()
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado.")
    reporte.estado = "resuelto"
    db.commit()
    db.refresh(reporte)
    return reporte


def listar_estaciones(db: Session):
    return db.query(EstacionPropia).all()


def crear_estacion(data: EstacionPropiaCreate, db: Session):
    nueva = EstacionPropia(**data.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return nueva


def cambiar_estado_estacion(eid: str, data: EstadoUpdate, db: Session):
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    estacion.activa = data.activa
    db.commit()
    db.refresh(estacion)
    return estacion


def eliminar_estacion(eid: str, db: Session):
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == eid).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación no encontrada.")
    db.delete(estacion)
    db.commit()
    return {"ok": True}


def listar_reservas(db: Session):
    return db.query(Reservas).all()


def actualizar_reserva(rid: str, data: AdminReservaUpdate, db: Session):
    reserva = db.query(Reservas).filter(Reservas.id == rid).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(reserva, key, value)
    db.commit()
    db.refresh(reserva)
    return reserva


def eliminar_reserva(rid: str, db: Session):
    reserva = db.query(Reservas).filter(Reservas.id == rid).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada.")
    db.delete(reserva)
    db.commit()
    return {"ok": True}


def listar_calificaciones(db: Session):
    return db.query(Calificaciones).all()