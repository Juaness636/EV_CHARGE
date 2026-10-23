// Panel de empresa en el móvil. Mismas rutas que el frontend web (J-K/frontend/src/api/empresa.api.ts).
// Corresponde a: J-K/app/controllers/empresa_*.py + J-K/app/routes/empresa_routes.py
// Todas las rutas cuelgan de /empresa y el backend deduce la empresa del token:
// ningún método manda empresa_id, y un 404 aquí significa "eso no es tuyo".
import { Platform } from 'react-native';
import { api, API_BASE_URL } from './httpClient';

export type EstadoEmpresa = 'pendiente' | 'aprobada' | 'suspendida';
export type EstadoEstacion = 'activa' | 'mantenimiento' | 'inactiva';
export type EstadoCargador = 'disponible' | 'fuera_servicio';
// La empresa resuelve o descarta; los demás estados los puede dejar el admin.
export type EstadoReporte = 'abierto' | 'resuelto' | 'descartado' | 'mantenimiento' | 'fuera_servicio';
export type EstadoIncidente = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado';
export type PrioridadIncidente = 'baja' | 'media' | 'alta';
export type AccionHistorial =
  | 'crear'
  | 'editar'
  | 'agregar_cargador'
  | 'quitar_cargador'
  | 'cambiar_estado'
  | 'abrir_incidente'
  | 'cerrar_incidente'
  | 'eliminar'
  | 'subir_foto'
  | 'quitar_foto';

// RN-E04: el backend exige 10 caracteres como mínimo al inhabilitar o borrar.
export const LONGITUD_MINIMA_MOTIVO = 10;

// Mismo enum del backend (app/utils/constantes.py: TIPOS_CONECTOR).
export const TIPOS_CONECTOR = ['CCS', 'Type 2', 'CHAdeMO', 'GB/T', 'J1772'] as const;

export interface EmpresaPerfil {
  id: string;
  usuario_id: string;
  nombre_comercial: string;
  razon_social?: string | null;
  nit?: string | null;
  telefono?: string | null;
  email_contacto?: string | null;
  direccion_sede?: string | null;
  descripcion?: string | null;
  color_hex: string;
  logo_url?: string | null;
  estado: EstadoEmpresa;
  // Palabras con las que se le asignan estaciones de la API ("enel x, enelx").
  palabras_clave?: string | null;
  created_at: string;
  total_estaciones: number;
  usuario_email?: string | null;
}

export interface Cargador {
  // null solo en estaciones antiguas sin cargadores registrados (campo legado).
  id: string | null;
  numero: number;
  tipo_conector: string;
  potencia_kw: number;
  corriente?: string | null;
  bahias: number;
  estado: EstadoCargador;
}

export interface CargadorCreate {
  numero: number;
  tipo_conector: string;
  potencia_kw: number;
  corriente?: string;
  bahias?: number;
  estado?: EstadoCargador;
}

export type CargadorUpdate = Partial<CargadorCreate>;

// Mismos límites del backend (app/utils/constantes.py).
export const FOTOS_MAXIMAS_POR_ESTACION = 8;
export const FOTO_TAMANO_MAXIMO_MB = 5;

export interface FotoEstacion {
  id: string;
  // Ruta relativa al backend (/media/...); usar urlMedia() para mostrarla.
  url: string;
}

// Convierte la ruta /media/... que guarda el backend en una URL completa para <Image>.
export const urlMedia = (ruta: string) => (/^https?:\/\//.test(ruta) ? ruta : `${API_BASE_URL}${ruta}`);

export interface EstacionEmpresa {
  id: string;
  nombre: string;
  direccion: string;
  lat: number;
  lon: number;
  descripcion?: string;
  operador: string;
  estado: EstadoEstacion;
  activa: boolean;
  tipo_conector?: string;
  potencia_kw?: number;
  created_at: string;
  cargadores: Cargador[];
  total_cargadores: number;
  cargadores_disponibles: number;
  incidentes_abiertos: number;
  reservas_canceladas?: number;
  fotos: FotoEstacion[];
}

export interface EstacionEmpresaCreate {
  nombre: string;
  direccion?: string;
  lat: number;
  lon: number;
  descripcion?: string;
  estado?: EstadoEstacion;
  cargadores: CargadorCreate[];
}

export type EstacionEmpresaUpdate = Partial<Omit<EstacionEmpresaCreate, 'cargadores'>>;

export interface Paginado<T> {
  total: number;
  page: number;
  limit: number;
  resultados: T[];
}

export interface HistorialRegistro {
  id: string;
  estacion_id: string;
  estacion_nombre: string;
  direccion: string;
  accion: AccionHistorial;
  motivo: string;
  usuario_nombre: string;
  detalle?: Record<string, unknown> | null;
  fecha: string;
}

export interface ReporteEmpresa {
  id: string;
  estacion_ocm_id: string;
  estacion_nombre: string;
  tipo: string;
  descripcion: string;
  estado: EstadoReporte;
  fecha: string;
  usuario_nombre: string;
}

export interface IncidenteEmpresa {
  id: string;
  estacion_id: string;
  estacion_nombre: string;
  cargador_id?: string | null;
  cargador_numero?: number | null;
  reporte_id?: string | null;
  tipo: string;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadIncidente;
  bloquea_estacion: boolean;
  estado: EstadoIncidente;
  fecha_inicio: string;
  fecha_fin?: string | null;
  solucion?: string | null;
  puede_reactivar: boolean;
}

export interface IncidenteCreate {
  estacion_id: string;
  cargador_id?: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  prioridad: PrioridadIncidente;
  bloquea_estacion: boolean;
}

export interface DashboardEmpresa {
  empresa: Pick<EmpresaPerfil, 'id' | 'nombre_comercial' | 'color_hex' | 'logo_url' | 'estado'>;
  kpis: {
    total_estaciones: number;
    estaciones_activas: number;
    estaciones_mantenimiento: number;
    total_cargadores: number;
    cargadores_disponibles: number;
    cargas_mes: number;
    kwh_mes: number;
    ingresos_mes: number;
    reservas_proximas: number;
    calificacion_promedio: number | null;
    total_resenas: number;
  };
  alertas: Array<{ tipo: string; mensaje: string; cantidad: number }>;
  reportes_pendientes: number;
  incidentes_abiertos: number;
  notificaciones: Array<{
    id: string;
    titulo: string;
    mensaje: string;
    tipo: string;
    leida: boolean;
    created_at: string;
  }>;
}

export interface ResumenEmpresa {
  desde: string;
  hasta: string;
  total_cargas: number;
  total_kwh: number;
  ingresos_estimados: number;
  promedio_kwh_por_carga: number;
  cargas_periodo_anterior: number;
  variacion_cargas_pct: number | null;
  total_estaciones: number;
  estaciones_activas: number;
  total_cargadores: number;
  cargadores_disponibles: number;
  reservas_activas: number;
  calificacion_promedio: number | null;
  total_resenas: number;
}

export interface EstadisticaPorEstacion {
  estacion_id: string;
  nombre: string;
  estado: EstadoEstacion;
  total_cargadores: number;
  cargas: number;
  kwh: number;
  ingresos: number;
  reservas_activas: number;
  incidentes_abiertos: number;
  calificacion_promedio: number | null;
}

export interface EstadisticaPorCargador {
  cargador_id: string;
  estacion_id: string;
  estacion_nombre: string;
  numero: number;
  tipo_conector: string;
  potencia_kw: number;
  estado: EstadoCargador;
  sesiones: number;
  kwh: number;
  participacion_pct: number;
}

export interface CargoPorCargador {
  resultados: EstadisticaPorCargador[];
  mas_usado: EstadisticaPorCargador | null;
  criterio: string;
  total_sesiones_con_cargador: number;
}

export interface SerieTemporal {
  granularidad: 'dia' | 'mes';
  desde: string;
  hasta: string;
  zona_horaria: string;
  puntos: Array<{ periodo: string; cargas: number; kwh: number; ingresos: number }>;
}

export interface ResenasEmpresa {
  promedio: number | null;
  total_general: number;
  total: number;
  distribucion: Record<string, number>;
  page: number;
  limit: number;
  resultados: Array<{
    id: string;
    estacion_id: string;
    estacion_nombre: string;
    puntaje: number;
    comentario: string;
    fecha: string;
    usuario_nombre: string;
  }>;
}

export interface FiltroPeriodo {
  desde?: string;
  hasta?: string;
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export async function obtenerPerfilEmpresa(): Promise<EmpresaPerfil> {
  const { data } = await api.get<EmpresaPerfil>('/empresa/perfil');
  return data;
}

export async function actualizarPerfilEmpresa(
  payload: Partial<Pick<EmpresaPerfil, 'nombre_comercial' | 'razon_social' | 'telefono' | 'email_contacto' | 'direccion_sede' | 'descripcion' | 'color_hex' | 'logo_url'>>,
): Promise<EmpresaPerfil> {
  const { data } = await api.put<EmpresaPerfil>('/empresa/perfil', payload);
  return data;
}

export async function cambiarPasswordEmpresa(oldPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>('/empresa/perfil/password', {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Estaciones y cargadores
// ---------------------------------------------------------------------------

export async function listarEstaciones(): Promise<EstacionEmpresa[]> {
  const { data } = await api.get<EstacionEmpresa[]>('/empresa/estaciones');
  return data;
}

export async function obtenerEstacion(id: string): Promise<EstacionEmpresa> {
  const { data } = await api.get<EstacionEmpresa>(`/empresa/estaciones/${id}`);
  return data;
}

export async function crearEstacion(payload: EstacionEmpresaCreate): Promise<EstacionEmpresa> {
  const { data } = await api.post<EstacionEmpresa>('/empresa/estaciones', payload);
  return data;
}

export async function actualizarEstacion(id: string, payload: EstacionEmpresaUpdate): Promise<EstacionEmpresa> {
  const { data } = await api.put<EstacionEmpresa>(`/empresa/estaciones/${id}`, payload);
  return data;
}

// RN-E04/RN-E06/RN-E08: el motivo es obligatorio y el backend cancela las reservas futuras.
export async function cambiarEstadoEstacion(
  id: string,
  estado: EstadoEstacion,
  motivo: string,
): Promise<EstacionEmpresa> {
  const { data } = await api.patch<EstacionEmpresa>(`/empresa/estaciones/${id}/estado`, { estado, motivo });
  return data;
}

export async function eliminarEstacion(id: string, motivo: string): Promise<{ ok: boolean; reservas_canceladas: number }> {
  const { data } = await api.delete<{ ok: boolean; reservas_canceladas: number }>(
    `/empresa/estaciones/${id}`,
    { params: { motivo } },
  );
  return data;
}

export async function agregarCargador(estacionId: string, payload: CargadorCreate): Promise<EstacionEmpresa> {
  const { data } = await api.post<EstacionEmpresa>(`/empresa/estaciones/${estacionId}/cargadores`, payload);
  return data;
}

export async function actualizarCargador(
  estacionId: string,
  cargadorId: string,
  payload: CargadorUpdate,
): Promise<EstacionEmpresa> {
  const { data } = await api.put<EstacionEmpresa>(
    `/empresa/estaciones/${estacionId}/cargadores/${cargadorId}`,
    payload,
  );
  return data;
}

export async function quitarCargador(estacionId: string, cargadorId: string): Promise<EstacionEmpresa> {
  const { data } = await api.delete<EstacionEmpresa>(
    `/empresa/estaciones/${estacionId}/cargadores/${cargadorId}`,
  );
  return data;
}

// Foto elegida con expo-image-picker: en web trae `file`; en Android/iOS, solo la uri local.
export interface FotoElegida {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  file?: File;
}

export async function subirFotoEstacion(estacionId: string, foto: FotoElegida): Promise<EstacionEmpresa> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const archivo = foto.file ?? (await (await fetch(foto.uri)).blob());
    form.append('archivo', archivo, foto.fileName || 'foto.jpg');
  } else {
    // React Native acepta {uri, name, type} como archivo de un FormData.
    form.append('archivo', {
      uri: foto.uri,
      name: foto.fileName || 'foto.jpg',
      type: foto.mimeType || 'image/jpeg',
    } as unknown as Blob);
  }
  const { data } = await api.post<EstacionEmpresa>(`/empresa/estaciones/${estacionId}/fotos`, form, {
    // Sin este encabezado axios convierte el FormData a JSON (la instancia usa JSON por defecto);
    // en el navegador axios lo quita y deja que se ponga el boundary solo.
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

export async function eliminarFotoEstacion(estacionId: string, fotoId: string): Promise<EstacionEmpresa> {
  const { data } = await api.delete<EstacionEmpresa>(`/empresa/estaciones/${estacionId}/fotos/${fotoId}`);
  return data;
}

// ---------------------------------------------------------------------------
// Historial, reportes e incidentes
// ---------------------------------------------------------------------------

export async function listarHistorial(params: {
  estacion_id?: string;
  accion?: AccionHistorial;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginado<HistorialRegistro>> {
  const { data } = await api.get<Paginado<HistorialRegistro>>('/empresa/historial', { params });
  return data;
}

export async function listarReportes(params: {
  estado?: EstadoReporte;
  estacion_id?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginado<ReporteEmpresa>> {
  const { data } = await api.get<Paginado<ReporteEmpresa>>('/empresa/reportes', { params });
  return data;
}

export async function cambiarEstadoReporte(
  id: string,
  estado: EstadoReporte,
): Promise<{ id: string; estado: EstadoReporte }> {
  const { data } = await api.patch<{ id: string; estado: EstadoReporte }>(
    `/empresa/reportes/${id}/estado`,
    { estado },
  );
  return data;
}

export async function reporteAIncidente(id: string): Promise<IncidenteEmpresa> {
  const { data } = await api.post<IncidenteEmpresa>(`/empresa/reportes/${id}/incidente`);
  return data;
}

export async function listarIncidentes(params: {
  estacion_id?: string;
  estado?: EstadoIncidente;
  tipo?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginado<IncidenteEmpresa>> {
  const { data } = await api.get<Paginado<IncidenteEmpresa>>('/empresa/incidentes', { params });
  return data;
}

export async function crearIncidente(payload: IncidenteCreate): Promise<IncidenteEmpresa> {
  const { data } = await api.post<IncidenteEmpresa>('/empresa/incidentes', payload);
  return data;
}

export async function obtenerIncidente(id: string): Promise<IncidenteEmpresa> {
  const { data } = await api.get<IncidenteEmpresa>(`/empresa/incidentes/${id}`);
  return data;
}

// Al cerrar el último incidente bloqueante el backend responde `puede_reactivar: true`;
// la decisión de reactivar la toma la empresa en el UI (RN-E07).
export async function cambiarEstadoIncidente(
  id: string,
  estado: EstadoIncidente,
  solucion?: string,
): Promise<IncidenteEmpresa> {
  const { data } = await api.patch<IncidenteEmpresa>(`/empresa/incidentes/${id}/estado`, { estado, solucion });
  return data;
}

// ---------------------------------------------------------------------------
// Panel, estadísticas y reporte mensual
// ---------------------------------------------------------------------------

export async function obtenerDashboard(): Promise<DashboardEmpresa> {
  const { data } = await api.get<DashboardEmpresa>('/empresa/dashboard');
  return data;
}

export async function obtenerResumen(filtro: FiltroPeriodo = {}): Promise<ResumenEmpresa> {
  const { data } = await api.get<ResumenEmpresa>('/empresa/estadisticas/resumen', { params: filtro });
  return data;
}

export async function estadisticasPorEstacion(filtro: FiltroPeriodo = {}): Promise<EstadisticaPorEstacion[]> {
  const { data } = await api.get<EstadisticaPorEstacion[]>('/empresa/estadisticas/estaciones', { params: filtro });
  return data;
}

export async function estadisticasPorCargador(
  filtro: FiltroPeriodo & { estacion_id?: string } = {},
): Promise<CargoPorCargador> {
  const { data } = await api.get<CargoPorCargador>('/empresa/estadisticas/cargadores', { params: filtro });
  return data;
}

export async function obtenerSerie(
  filtro: FiltroPeriodo & { granularidad?: 'dia' | 'mes' } = {},
): Promise<SerieTemporal> {
  const { data } = await api.get<SerieTemporal>('/empresa/estadisticas/serie', { params: filtro });
  return data;
}

export async function listarResenas(
  params: { estacion_id?: string; puntaje?: number; desde?: string; hasta?: string; page?: number; limit?: number } = {},
): Promise<ResenasEmpresa> {
  const { data } = await api.get<ResenasEmpresa>('/empresa/resenas', { params });
  return data;
}

// Estaciones de OpenChargeMap asignadas a la empresa por sus palabras clave.
// No se crean ni se borran desde aquí: solo se consulta y se cambia su estado.
export interface EstacionApiEmpresa {
  id: string;
  nombre: string;
  direccion: string;
  operador: string;
  ciudad: string;
  departamento: string;
  lat: number;
  lon: number;
  estado: 'activa' | 'mantenimiento' | 'inactiva';
  conectores: number;
}

export async function listarEstacionesApiEmpresa(): Promise<EstacionApiEmpresa[]> {
  const { data } = await api.get<EstacionApiEmpresa[]>('/empresa/estaciones/api', { timeout: 45000 });
  return data;
}

export async function cambiarEstadoEstacionApiEmpresa(id: string, estado: EstacionApiEmpresa['estado']): Promise<{ estado: string }> {
  const { data } = await api.patch<{ estado: string }>(`/empresa/estaciones/api/${id}/estado`, { estado });
  return data;
}
