export const BOGOTA: [number, number] = [4.6097, -74.0817];

// `date_trunc` devuelve un timestamp; en la tabla solo se muestra el bucket.
export const periodo = (valor: string, granularidad: 'dia' | 'mes' = 'dia') =>
  valor.includes('T') ? valor.slice(0, granularidad === 'mes' ? 7 : 10) : valor;

export const fecha = (value?: string | null) =>
  value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

export const fechaCorta = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('es-CO', { dateStyle: 'medium' }) : 'Sin fecha';

// Comparación exacta: con `includes`, 'inactiva' contiene 'activa' y saldría en verde.
const ESTADOS_OK = new Set(['activa', 'resuelto', 'cerrado', 'disponible', 'aprobada', 'realizada']);
const ESTADOS_PENDIENTES = new Set(['mantenimiento', 'pendiente', 'abierto', 'en_progreso']);
const ESTADOS_MAL = new Set(['inactiva', 'descartado', 'fuera_servicio', 'suspendida', 'cancelada', 'rechazada']);

export const estadoClase = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (ESTADOS_OK.has(value)) return 'status-active';
  if (ESTADOS_PENDIENTES.has(value)) return 'status-pending';
  if (ESTADOS_MAL.has(value)) return 'status-inactive';
  return 'status-default';
};

export const dinero = (valor: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor || 0);
