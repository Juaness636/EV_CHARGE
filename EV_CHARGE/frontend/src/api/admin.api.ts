// Corresponde a: app/controllers/admin_controller.py + app/routes/admin_routes.py
// Todas requieren usuario admin (require_admin en el backend).
import { api } from './httpClient';

export interface AdminEstadisticas {
  total_usuarios: number;
  total_vehiculos: number;
  total_reservas_activas: number;
  total_cargas: number;
  total_kwh_cargados: number;
  total_reportes_abiertos: number;
  total_estaciones_propias: number;
}

export interface EstacionPropiaCreate {
  nombre: string;
  direccion?: string;
  lat: number;
  lon: number;
  tipo_conector: string;
  potencia_kw: number;
  descripcion?: string;
  activa?: boolean;
}

export interface AdminReservaUpdate {
  estado?: string;
  fecha_hora_inicio?: string;
  fecha_hora_fin?: string;
}

export interface ReporteAdmin {
  id: string;
  usuario_id: string;
  estacion_ocm_id: string;
  estacion_nombre?: string;
  tipo: string;
  descripcion?: string;
  estado: string;
  fecha: string;
}

export interface CalificacionAdmin {
  id: string;
  usuario_id: string;
  estacion_ocm_id: string;
  estacion_nombre?: string;
  puntaje: number;
  comentario?: string;
  fecha: string;
}

export async function listarUsuarios(): Promise<unknown[]> {
  const { data } = await api.get('/admin/usuarios');
  return data;
}

export async function obtenerEstadisticas(): Promise<AdminEstadisticas> {
  const { data } = await api.get<AdminEstadisticas>('/admin/estadisticas');
  return data;
}

export async function listarReportesAdmin(): Promise<ReporteAdmin[]> {
  const { data } = await api.get<ReporteAdmin[]>('/admin/reportes');
  return data;
}

export async function resolverReporte(id: string): Promise<unknown> {
  const { data } = await api.patch(`/admin/reportes/${id}/resolver`);
  return data;
}

export async function listarEstacionesAdmin(): Promise<unknown[]> {
  const { data } = await api.get('/admin/estaciones');
  return data;
}

export async function crearEstacion(payload: EstacionPropiaCreate): Promise<unknown> {
  const { data } = await api.post('/admin/estaciones', payload);
  return data;
}

export async function cambiarEstadoEstacion(id: string, activa: boolean): Promise<unknown> {
  const { data } = await api.patch(`/admin/estaciones/${id}/estado`, { activa });
  return data;
}

export async function eliminarEstacionAdmin(id: string): Promise<void> {
  await api.delete(`/admin/estaciones/${id}`);
}

export async function listarReservasAdmin(): Promise<unknown[]> {
  const { data } = await api.get('/admin/reservas');
  return data;
}

export async function actualizarReservaAdmin(id: string, payload: AdminReservaUpdate): Promise<unknown> {
  const { data } = await api.put(`/admin/reservas/${id}`, payload);
  return data;
}

export async function eliminarReservaAdmin(id: string): Promise<void> {
  await api.delete(`/admin/reservas/${id}`);
}

export async function listarCalificacionesAdmin(): Promise<CalificacionAdmin[]> {
  const { data } = await api.get<CalificacionAdmin[]>('/admin/calificaciones');
  return data;
}
