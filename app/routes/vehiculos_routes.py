# Backend/routes/vehiculos_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.vehiculo_controller import (
    get_vehicles,
    get_vehicle,
    create_vehicle,
    update_vehicle,
    delete_vehicle
)
from schemas.vehiculo_schema import VehiculoSchema

router = APIRouter(
    prefix="/vehicles",
    tags=["Vehículos"]
)

@router.get("")
def vehicles(db: Session = Depends(get_db)):
    return get_vehicles(db)

@router.get("/{id}")
def vehicle(id: str, db: Session = Depends(get_db)):
    return get_vehicle(id, db)

@router.post("")
def store_vehicle(vehicle: VehiculoSchema, db: Session = Depends(get_db)):
    return create_vehicle(vehicle, db)

@router.put("/{id}")
def edit_vehicle(id: str, vehicle: VehiculoSchema, db: Session = Depends(get_db)):
    return update_vehicle(id, vehicle, db)

@router.delete("/{id}")
def destroy_vehicle(id: str, db: Session = Depends(get_db)):
    return delete_vehicle(id, db)