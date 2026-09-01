# Backend/schemas/mapa_schema.py
from pydantic import BaseModel
from typing import Optional, List, Dict


class AlertaWaze(BaseModel):
    tipo: str
    ubicacion: Optional[Dict] = None
    descripcion: str
    severidad: str
    latitud: Optional[float] = None
    longitud: Optional[float] = None


class AatascoWaze(BaseModel):
    id: Optional[str] = None
    velocidad_actual_kmh: float
    velocidad_limite_kmh: float
    nivel_congestion: str  # bajo, medio, alto, crítico
    longitud_km: float
    latitud: Optional[float] = None
    longitud: Optional[float] = None
    tiempo_retraso_min: int


class RecomendacionRuta(BaseModel):
    tipo: str
    mensaje: str
    severidad: str  # baja, media, alta


class AdvertenciaRuta(BaseModel):
    tipo: str
    mensaje: str
    ubicacion: Optional[Dict] = None


class ResumenWaze(BaseModel):
    total_atascos: int
    atascos_criticos: int
    total_alertas: int
    alertas_graves: int


class EvaluacionRutaWaze(BaseModel):
    disponible: bool
    eta_ajustada_min: int
    retraso_estimado_min: int = 0
    advertencias: List[AdvertenciaRuta] = []
    recomendaciones: List[RecomendacionRuta] = []
    resumen: Optional[ResumenWaze] = None


class EstacionConRuta(BaseModel):
    id: str
    nombre: str
    lat: float
    lon: float
    parada_numero: int
    distancia_a_estacion_km: Optional[float] = None


class PlanViajeConWaze(BaseModel):
    distancia_total_km: float
    duracion_base_min: int
    duracion_con_trafico_min: int
    paradas_sugeridas: int
    geometry: Dict  # GeoJSON geometry
    estaciones_en_ruta: List[EstacionConRuta]
    evaluacion_waze: EvaluacionRutaWaze
