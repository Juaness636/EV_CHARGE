// Utilidades de estaciones compartidas entre el mapa y los dashboards.
import type { EstacionOCM } from '../features/mapa/types';

export const TIPOS_CONECTOR = ['CCS', 'Type 2', 'CHAdeMO', 'GB/T', 'J1772'] as const;

export function departamentoCanonico(departamento?: string): string {
  const valor = (departamento || '').trim();
  const clave = valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  if (clave === 'dc' || clave === 'bogota' || clave === 'bogota dc' || clave === 'bogota distrito capital') return 'Bogotá D.C.';
  const nombres: Record<string, string> = {
    antioquia: 'Antioquia', boyaca: 'Boyacá', bolivar: 'Bolívar', cauca: 'Cauca',
    caldas: 'Caldas', cundinamarca: 'Cundinamarca', meta: 'Meta', narino: 'Nariño',
    quindio: 'Quindío', santander: 'Santander', tolima: 'Tolima', huila: 'Huila',
    atlantico: 'Atlántico', cordoba: 'Córdoba', cesar: 'Cesar', guajira: 'La Guajira',
    risaralda: 'Risaralda', sucre: 'Sucre', valle: 'Valle del Cauca', 'valle del cauca': 'Valle del Cauca',
    'norte de santander': 'Norte de Santander', magdalena: 'Magdalena', choco: 'Chocó', casanare: 'Casanare', caqueta: 'Caquetá',
  };
  return nombres[clave] || valor;
}

export function departamentoDe(estacion: EstacionOCM): string {
  return departamentoCanonico(estacion.departamento || estacion.StateOrProvince || estacion.AddressInfo?.StateOrProvince);
}

// Compara tipos de conector sin importar espacios, guiones o mayúsculas.
export function conectorCoincide(tipoCargador: string, tipoVehiculo: string): boolean {
  const normalizar = (valor: string) => valor.toLowerCase().replace(/[\s\-_/()]+/g, '');
  const cargador = normalizar(tipoCargador);
  const vehiculo = normalizar(tipoVehiculo);
  return !vehiculo || cargador.includes(vehiculo) || vehiculo.includes(cargador);
}

export function nombreEstacion(estacion?: EstacionOCM | null): string {
  return estacion?.AddressInfo?.Title || (estacion ? `Estación ${estacion.ID}` : 'Estación');
}

export function etiquetaEstado(estado?: string): string {
  if (estado === 'mantenimiento') return 'En mantenimiento';
  if (estado === 'inactiva' || estado === 'fuera_servicio') return 'Fuera de servicio';
  if (estado === 'reservada') return 'Reservada';
  if (estado === 'ocupada') return 'En uso';
  if (estado === 'resuelto') return 'Resuelto';
  if (estado === 'abierto') return 'Abierto';
  return 'Disponible';
}

export function distanciaKm(a: [number, number], b: [number, number]): number {
  const radio = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return radio * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function calcularRumbo(origen: [number, number], destino: [number, number]): number {
  const lat1 = (origen[0] * Math.PI) / 180;
  const lat2 = (destino[0] * Math.PI) / 180;
  const deltaLon = ((destino[1] - origen[1]) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
