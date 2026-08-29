// Corresponde a: app/controllers/mapa_controller.py + app/routes/mapa_routes.py
import { api } from './httpClient';

export interface RutaVial {
  type: string;
  coordinates: [number, number][];
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
