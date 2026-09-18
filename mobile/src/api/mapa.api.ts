// Servicio de Mapas y Rutas para React Native
import { api } from './httpClient';

export interface RutaVial {
  type: string;
  coordinates: [number, number][];
}

export interface EstacionConRuta {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  parada_numero: number;
}

export interface InstruccionRuta {
  tipo: string;
  modificador: string;
  nombre: string;
  distancia_m: number;
}

export interface PlanViaje {
  distancia_total_km: number;
  duracion_min: number;
  paradas_sugeridas: number;
  geometry: RutaVial;
  instrucciones?: InstruccionRuta[];
  estaciones_en_ruta: EstacionConRuta[];
}

export interface EstacionAPI {
  id: string | number;
  nombre: string;
  direccion?: string;
  lat: number;
  lon: number;
  estado?: string;
  puntos_carga?: number;
  conectores?: string[];
}

export async function listarEstacionesMapa(): Promise<EstacionAPI[]> {
  const { data } = await api.get<EstacionAPI[]>('/estaciones-mapa');
  return data;
}

export async function listarEstacionesCercanas(
  latitud: number,
  longitud: number,
  radioKm = 25,
): Promise<EstacionAPI[]> {
  const { data } = await api.get<EstacionAPI[]>('/estaciones-cercanas', {
    params: { latitud, longitud, radio_km: radioKm },
  });
  return data;
}

export async function listarEstacionesBogota(): Promise<EstacionAPI[]> {
  const { data } = await api.get<EstacionAPI[]>('/estaciones-bogota');
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
    params: {
      origen_lat: origenLat,
      origen_lon: origenLon,
      destino_lat: destinoLat,
      destino_lon: destinoLon,
      autonomia_km: autonomiaKm,
    },
  });
  return data;
}
