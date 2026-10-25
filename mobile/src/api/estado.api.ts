// Corresponde a: app/controllers/estado_controller.py + app/routes/estado_routes.py
import { api } from './httpClient';

export interface EstadoEstacion {
  estacion_ocm_id: string;
  cargadores_reservados?: string[];
  reservas_por_cargador?: Array<{ cargador_id: string; reservado_por: string }>;
  // Cargadores donde alguien escaneó el QR y está cargando ahora mismo.
  cargadores_en_uso?: string[];
  [key: string]: unknown;
}

// Pública, no requiere auth
export async function obtenerEstadoEstacion(estacionId: string): Promise<EstadoEstacion> {
  const { data } = await api.get<EstadoEstacion>(`/estado/${estacionId}`);
  return data;
}

// Estado de muchas estaciones en una sola petición (el mapa lo refresca cada pocos segundos).
export async function obtenerEstadosLote(ids: string[]): Promise<Record<string, EstadoEstacion>> {
  const { data } = await api.post<Record<string, EstadoEstacion>>('/estado/lote', { ids });
  return data;
}
