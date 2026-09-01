// Corresponde a: app/controllers/mapa_controller.py + app/routes/mapa_routes.py
import { api } from './httpClient';

export interface RutaVial {
  type: string;
  coordinates: [number, number][];
}

export interface Alerta {
  tipo: string;
  ubicacion?: Record<string, unknown>;
  descripcion: string;
  severidad: string;
  latitud?: number;
  longitud?: number;
}

export interface Atasco {
  id?: string;
  velocidad_actual_kmh: number;
  velocidad_limite_kmh: number;
  nivel_congestion: string;
  longitud_km: number;
  latitud?: number;
  longitud?: number;
  tiempo_retraso_min: number;
}

export interface Recomendacion {
  tipo: string;
  mensaje: string;
  severidad: string;
}

export interface Advertencia {
  tipo: string;
  mensaje: string;
  ubicacion?: Record<string, unknown>;
}

export interface ResumenWaze {
  total_atascos: number;
  atascos_criticos: number;
  total_alertas: number;
  alertas_graves: number;
}

export interface EvaluacionRutaWaze {
  disponible: boolean;
  eta_ajustada_min: number;
  retraso_estimado_min: number;
  advertencias: Advertencia[];
  recomendaciones: Recomendacion[];
  resumen?: ResumenWaze;
}

export interface EstacionConRuta {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  parada_numero: number;
  distancia_a_estacion_km?: number;
}

export interface PlanViajeConWaze {
  distancia_total_km: number;
  duracion_base_min: number;
  duracion_con_trafico_min: number;
  paradas_sugeridas: number;
  geometry: RutaVial;
  estaciones_en_ruta: EstacionConRuta[];
  evaluacion_waze: EvaluacionRutaWaze;
}

export interface AlertasAreaWaze {
  disponible: boolean;
  alertas: Alerta[];
  atascos: Atasco[];
  info?: Record<string, unknown>;
}

export interface PlanViaje {
  ruta: RutaVial;
  distancia_total_km: number;
  paradas_sugeridas: unknown[];
  [key: string]: unknown;
}

export async function obtenerRutaVial(
  userLat: number,
  userLon: number,
  destLat: number,
  destLon: number,
): Promise<RutaVial> {
  const { data } = await api.get<RutaVial>('/buscar-ruta', {
    params: { user_lat: userLat, user_lon: userLon, dest_lat: destLat, dest_lon: destLon },
  });
  return data;
}

export async function planificarViaje(
  origenLat: number,
  origenLon: number,
  destinoLat: number,
  destinoLon: number,
  autonomiaKm = 300,
): Promise<PlanViaje> {
  const { data } = await api.get<PlanViaje>('/planificar-viaje', {
    params: { origen_lat: origenLat, origen_lon: origenLon, destino_lat: destinoLat, destino_lon: destinoLon, autonomia_km: autonomiaKm },
  });
  return data;
}

export async function planificarViajeConWaze(
  origenLat: number,
  origenLon: number,
  destinoLat: number,
  destinoLon: number,
  autonomiaKm = 300,
): Promise<PlanViajeConWaze> {
  const { data } = await api.get<PlanViajeConWaze>('/planificar-viaje-waze', {
    params: { origen_lat: origenLat, origen_lon: origenLon, destino_lat: destinoLat, destino_lon: destinoLon, autonomia_km: autonomiaKm },
  });
  return data;
}

export async function obtenerAlertasWaze(
  latMin: number,
  lonMin: number,
  latMax: number,
  lonMax: number,
): Promise<AlertasAreaWaze> {
  const { data } = await api.get<AlertasAreaWaze>('/alertas-waze', {
    params: { lat_min: latMin, lon_min: lonMin, lat_max: latMax, lon_max: lonMax },
  });
  return data;
}
