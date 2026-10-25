// Formatos de moneda y fecha. Se formatea a mano porque Intl con locale es-CO
// no está completo en todos los motores JS de Android.
export function pesos(valor: number | string | undefined | null): string {
  const numero = Math.round(Number(valor) || 0);
  const texto = Math.abs(numero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${numero < 0 ? '-' : ''}$${texto} COP`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const pad = (n: number) => String(n).padStart(2, '0');

export function hora(fecha: Date): string {
  const h = fecha.getHours();
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.';
  return `${h % 12 || 12}:${pad(fecha.getMinutes())} ${sufijo}`;
}

export function fechaCorta(valor?: string | Date | null): string {
  if (!valor) return 'Sin fecha';
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

export function fechaHora(valor?: string | Date | null): string {
  if (!valor) return 'Sin fecha';
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  if (Number.isNaN(fecha.getTime())) return 'Sin fecha';
  return `${fechaCorta(fecha)}, ${hora(fecha)}`;
}

export function etiquetaDia(fecha: Date): string {
  const hoy = new Date();
  const manana = new Date();
  manana.setDate(hoy.getDate() + 1);
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(fecha, hoy)) return 'Hoy';
  if (mismoDia(fecha, manana)) return 'Mañana';
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} ${MESES[fecha.getMonth()]}`;
}

export function tiempoRelativo(valor: string): string {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(valor).getTime()) / 60000));
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'Ayer' : `Hace ${dias} días`;
}

// Próxima hora en punto (ej. 14:20 -> 15:00), igual que el botón "Ahora" del web.
export function proximaHora(): Date {
  const fecha = new Date();
  fecha.setMinutes(0, 0, 0);
  fecha.setHours(fecha.getHours() + 1);
  return fecha;
}

// Botón "Ahora": en 5 a 10 minutos (redondeado a 5; deja tiempo para pagar), así la reserva empieza ya y el
// QR del cargador se puede escanear de inmediato (desde 15 min antes del inicio).
export function enUnosMinutos(): Date {
  const fecha = new Date(Date.now() + 5 * 60000);
  fecha.setSeconds(0, 0);
  fecha.setMinutes(Math.ceil(fecha.getMinutes() / 5) * 5);
  return fecha;
}

export function sumarHoras(fecha: Date, horas: number): Date {
  return new Date(fecha.getTime() + horas * 3600000);
}

export const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export function requisitosPassword(pass: string) {
  return {
    min: pass.length >= 8,
    may: /[A-Z]/.test(pass),
    low: /[a-z]/.test(pass),
    num: /\d/.test(pass),
    sim: /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pass),
  };
}

export const listaRequisitosPassword = [
  ['min', 'Mínimo 8 caracteres'],
  ['may', 'Una mayúscula'],
  ['low', 'Una minúscula'],
  ['num', 'Un número'],
  ['sim', 'Un símbolo'],
] as const;
