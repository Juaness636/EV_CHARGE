# Backend/controllers/calificaciones_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.calificacion_model import Calificaciones
from app.schemas.calificaciones_schema import CalificacionCreate, CalificacionUpdate


def calificar(db: Session, usuario_id: str, data: CalificacionCreate):
    if not (1 <= data.puntaje <= 5):
        raise HTTPException(status_code=400, detail="Puntaje entre 1 y 5")

    existente = db.query(Calificaciones).filter(
        Calificaciones.usuario_id == usuario_id,
        Calificaciones.estacion_ocm_id == data.estacion_ocm_id,
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya calificaste esta estación. Puedes editar tu calificación existente.")

    cal = Calificaciones(usuario_id=usuario_id, **data.model_dump())
    db.add(cal)
    db.commit()
    return {"ok": True}


def mis_calificaciones(db: Session, usuario_id: str):
    return db.query(Calificaciones).filter(Calificaciones.usuario_id == usuario_id).order_by(Calificaciones.fecha.desc()).all()


def actualizar_calificacion(db: Session, usuario_id: str, cid: str, data: CalificacionUpdate):
    cal = db.query(Calificaciones).filter(Calificaciones.id == cid, Calificaciones.usuario_id == usuario_id).first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calificación no encontrada")
    if not (1 <= data.puntaje <= 5):
        raise HTTPException(status_code=400, detail="Puntaje entre 1 y 5")

    cal.puntaje = data.puntaje
    cal.comentario = data.comentario
    db.commit()
    db.refresh(cal)
    return cal


def eliminar_calificacion(db: Session, usuario_id: str, cid: str):
    cal = db.query(Calificaciones).filter(Calificaciones.id == cid, Calificaciones.usuario_id == usuario_id).first()
    if not cal:
        raise HTTPException(status_code=404, detail="Calificación no encontrada")

    db.delete(cal)
    db.commit()
    return {"ok": True}


def calificaciones_estacion(db: Session, estacion_id: str):
    cals = db.query(Calificaciones).filter(Calificaciones.estacion_ocm_id == estacion_id).order_by(Calificaciones.fecha.desc()).all()
    promedio = round(sum(c.puntaje for c in cals) / len(cals), 1) if cals else 0
    return {"promedio": promedio, "total": len(cals), "calificaciones": cals}