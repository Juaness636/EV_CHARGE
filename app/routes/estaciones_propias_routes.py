# Backend/routes/estaciones_propias_routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from config.database import get_db

from controllers.estacion_propias_controller import (
    get_all_stations,
    get_station,
    create_station,
    update_station,
    delete_station
)
from schemas.estacion_propia_schema import EstacionPropiaSchema

router = APIRouter(
    prefix="/own-stations",
    tags=["Estaciones Propias"]
)

@router.get("")
def stations(db: Session = Depends(get_db)):
    return get_all_stations(db)

@router.get("/{id}")
def station(id: str, db: Session = Depends(get_db)):
    return get_station(id, db)

@router.post("")
def store_station(station: EstacionPropiaSchema, db: Session = Depends(get_db)):
    return create_station(station, db)

@router.put("/{id}")
def edit_station(id: str, station: EstacionPropiaSchema, db: Session = Depends(get_db)):
    return update_station(id, station, db)

@router.delete("/{id}")
def destroy_station(id: str, db: Session = Depends(get_db)):
    return delete_station(id, db)