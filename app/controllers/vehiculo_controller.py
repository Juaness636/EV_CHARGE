# Backend/controllers/vehiculo_controller.py
from sqlalchemy.orm import Session
from fastapi import HTTPException
from models import vehiculos  
from schemas.vehiculo_schema import VehiculoSchema
import uuid

def validar_uuid(id_string: str):
    try:
        uuid.UUID(id_string)
    except ValueError:
        raise HTTPException(status_code=400, detail="El formato del ID (UUID) suministrado no es válido.")

def get_vehicles(db: Session):
    return db.query(vehiculos).all()

def get_vehicle(id: str, db: Session):
    validar_uuid(id)
    vehiculo = db.query(vehiculos).filter(vehiculos.id == id).first()
    if not vehiculo:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    return vehiculo

def create_vehicle(vehicle: VehiculoSchema, db: Session):
    validar_uuid(vehicle.usuario_id)
    
    nuevo_vehiculo = vehiculos(
        usuario_id=vehicle.usuario_id,
        marca=vehicle.marca,
        modelo=vehicle.modelo,
        anio=vehicle.anio,
        autonomia_km=vehicle.autonomia_km,
        tipo_conector=vehicle.tipo_conector,
        activo=vehicle.activo
    )
    db.add(nuevo_vehiculo)
    db.commit()
    db.refresh(nuevo_vehiculo)
    return {"mensaje": "Vehículo registrado con éxito ✅", "vehiculo": nuevo_vehiculo}

def update_vehicle(id: str, vehicle: VehiculoSchema, db: Session):
    validar_uuid(id)
    validar_uuid(vehicle.usuario_id)
    
    vehiculo = db.query(vehiculos).filter(vehiculos.id == id).first()
    if not vehiculo:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    
    vehiculo.usuario_id = vehicle.usuario_id
    vehiculo.marca = vehicle.marca
    vehiculo.modelo = vehicle.modelo
    vehiculo.anio = vehicle.anio
    vehiculo.autonomia_km = vehicle.autonomia_km
    vehiculo.tipo_conector = vehicle.tipo_conector
    vehiculo.activo = vehicle.activo
    
    db.commit()
    db.refresh(vehiculo)
    return {"mensaje": "Vehículo actualizado correctamente ✅", "vehiculo": vehiculo}

def delete_vehicle(id: str, db: Session):
    validar_uuid(id)
    vehiculo = db.query(vehiculos).filter(vehiculos.id == id).first()
    if not vehiculo:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado.")
    
    db.delete(vehiculo)
    db.commit()
    return {"mensaje": f"Vehículo con ID {id} eliminado permanentemente ❌"}