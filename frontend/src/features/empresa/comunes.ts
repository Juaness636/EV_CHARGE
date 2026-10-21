export const BOGOTA: [number, number] = [4.6097, -74.0817];

// `date_trunc` devuelve un timestamp; en la tabla solo se muestra el bucket.
export const periodo = (valor: string, granularidad: 'dia' | 'mes' = 'dia') =>
  valor.includes('T') ? valor.slice(0, granularidad === 'mes' ? 7 : 10) : valor;

export const fecha = (value?: string | null) =>
  value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';

export const fechaCorta = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('es-CO', { dateStyle: 'medium' }) : 'Sin fecha';

export const estadoClase = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (value.includes('activa') || value.includes('resuelto') || value.includes('cerrado') || value.includes('disponible') || value.includes('aprobada')) return 'status-active';
  if (value.includes('mantenimiento') || value.includes('pendiente') || value.includes('abierto') || value.includes('en_progreso')) return 'status-pending';
  if (value.includes('inactiva') || value.includes('descartado') || value.includes('fuera_servicio') || value.includes('suspendida') || value.includes('cancelada')) return 'status-inactive';
  return 'status-default';
};

export const dinero = (valor: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor || 0);
