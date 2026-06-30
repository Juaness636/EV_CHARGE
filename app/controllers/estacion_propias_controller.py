# Backend/controllers/estacion_propia_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models.models import EstacionPropia
from schemas.estacion_propia_schema import EstacionPropiaSchema
import uuid

def validar_uuid(id_string: str):
    try:
        uuid.UUID(id_string)
    except ValueError:
        raise HTTPException(status_code=400, detail="El formato del ID (UUID) suministrado no es válido.")

def get_all_stations(db: Session):
    return db.query(EstacionPropia).all()

def get_station(id: str, db: Session):
    validar_uuid(id)
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == id).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación propia no encontrada.")
    return estacion

def create_station(station: EstacionPropiaSchema, db: Session):
    nueva_estacion = EstacionPropia(
        nombre=station.nombre,
        direccion=station.direccion,
        lat=station.lat,
        lon=station.lon,
        tipo_conector=station.tipo_conector,
        potencia_kw=station.potencia_kw,
        descripcion=station.descripcion,
        activa=station.activa
    )
    db.add(nueva_estacion)
    db.commit()
    db.refresh(nueva_estacion)
    return {"mensaje": "Estación propia registrada con éxito ✅", "estacion": nueva_estacion}

def update_station(id: str, station: EstacionPropiaSchema, db: Session):
    validar_uuid(id)
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == id).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación propia no encontrada.")
    
    estacion.nombre = station.nombre
    estacion.direccion = station.direccion
    estacion.lat = station.lat
    estacion.lon = station.lon
    estacion.tipo_conector = station.tipo_conector
    estacion.potencia_kw = station.potencia_kw
    estacion.descripcion = station.descripcion
    estacion.activa = station.activa
    
    db.commit()
    db.refresh(estacion)
    return {"mensaje": "Estación propia actualizada correctamente ✅", "estacion": estacion}

def delete_station(id: str, db: Session):
    validar_uuid(id)
    estacion = db.query(EstacionPropia).filter(EstacionPropia.id == id).first()
    if not estacion:
        raise HTTPException(status_code=404, detail="Estación propia no encontrada.")
    
    db.delete(estacion)
    db.commit()
    return {"mensaje": f"Estación propia con ID {id} eliminada permanentemente ❌"}