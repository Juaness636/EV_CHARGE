# Backend/controllers/cargas_controller.py
from sqlalchemy.orm import Session

from app.models.carga_model import Cargas
from app.schemas.cargas_schema import CargaCreate


def listar_cargas(db: Session, usuario_id: str):
    return (
        db.query(Cargas)
        .filter(Cargas.usuario_id == usuario_id)
        .order_by(Cargas.fecha.desc())
        .all()
    )


def estadisticas_cargas(db: Session, usuario_id: str):
    cargas = db.query(Cargas).filter(Cargas.usuario_id == usuario_id).all()
    total_kwh = sum(c.kwh_cargados for c in cargas)
    total_costo = sum(c.costo_estimado for c in cargas)
    return {
        "total_sesiones": len(cargas),
        "total_kwh": round(total_kwh, 2),
        "total_costo": round(total_costo, 0),
    }


def crear_carga(db: Session, usuario_id: str, data: CargaCreate):
    carga = Cargas(usuario_id=usuario_id, **data.model_dump())
    db.add(carga)
    db.commit()
    db.refresh(carga)
    return carga