# app/routes/mapa_routes.py
from fastapi import APIRouter
from app.controllers.mapa_controller import MapaController

router = APIRouter(tags=["Mapa y Servicios Externos"])
mapa_controller = MapaController()

@router.get("/buscar-ruta")
def buscar_ruta(user_lat: float, user_lon: float, dest_lat: float, dest_lon: float):
    return mapa_controller.obtener_ruta_vial(user_lat, user_lon, dest_lat, dest_lon)

@router.get("/planificar-viaje")
def planificar_viaje(origen_lat: float, origen_lon: float, destino_lat: float, destino_lon: float, autonomia_km: float = 300):
    return mapa_controller.planificar_viaje(origen_lat, origen_lon, destino_lat, destino_lon, autonomia_km)