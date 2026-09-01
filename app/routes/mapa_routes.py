# app/routes/mapa_routes.py
from fastapi import APIRouter
from app.controllers.mapa_controller import MapaController
from app.schemas.mapa_schema import PlanViajeConWaze
from app.config.database import get_db
from app.controllers.admin_controller import listar_estaciones_mapa
from fastapi import Depends
from sqlalchemy.orm import Session
import os

router = APIRouter(tags=["Mapa y Servicios Externos"])
mapa_controller = MapaController()

@router.get("/debug/verificar-waze-key")
def verificar_waze_key():
    """Endpoint de debug para verificar si WAZE_API_KEY está cargada"""
    api_key = os.getenv("WAZE_API_KEY")
    if api_key:
        return {
            "estado": "✅ API Key detectada",
            "api_key_primeros_caracteres": api_key[:10] + "..." if len(api_key) > 10 else api_key,
            "longitud": len(api_key)
        }
    else:
        return {
            "estado": "❌ WAZE_API_KEY NO ENCONTRADA",
            "mensaje": "Verifica que el archivo .env esté configurado correctamente"
        }

@router.get("/debug/verificar-ocm-key")
def verificar_ocm_key():
    """Endpoint de debug para verificar si OCM_API_KEY está cargada"""
    api_key = os.getenv("OCM_API_KEY")
    if api_key:
        return {
            "estado": "✅ OCM API Key detectada",
            "api_key": api_key,
            "longitud": len(api_key)
        }
    else:
        return {
            "estado": "❌ OCM_API_KEY NO ENCONTRADA",
            "mensaje": "Verifica que el archivo .env esté configurado correctamente"
        }

@router.get("/buscar-ruta")
def buscar_ruta(user_lat: float, user_lon: float, dest_lat: float, dest_lon: float):
    return mapa_controller.obtener_ruta_vial(user_lat, user_lon, dest_lat, dest_lon)

@router.get("/planificar-viaje")
def planificar_viaje(origen_lat: float, origen_lon: float, destino_lat: float, destino_lon: float, autonomia_km: float = 300):
    return mapa_controller.planificar_viaje(origen_lat, origen_lon, destino_lat, destino_lon, autonomia_km)

@router.get("/planificar-viaje-waze", response_model=PlanViajeConWaze)
def planificar_viaje_con_waze(origen_lat: float, origen_lon: float, destino_lat: float, destino_lon: float, autonomia_km: float = 300):
    """Planifica viaje considerando tráfico y alertas de Waze"""
    return mapa_controller.planificar_viaje_con_waze(origen_lat, origen_lon, destino_lat, destino_lon, autonomia_km)

@router.get("/mostrar-estacion")
def obtener_estaciones(lat: float, lon: float):
    return mapa_controller.obtener_estaciones_cercanas(lat, lon)


@router.get("/estaciones-mapa")
def estaciones_mapa(db: Session = Depends(get_db)):
    return listar_estaciones_mapa(db)

@router.get("/alertas-waze")
def obtener_alertas_waze(lat_min: float, lon_min: float, lat_max: float, lon_max: float):
    """Obtiene alertas y atascos de Waze en un área específica"""
    return mapa_controller.obtener_alertas_area(lat_min, lon_min, lat_max, lon_max)