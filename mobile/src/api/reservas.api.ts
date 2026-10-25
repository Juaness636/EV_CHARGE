// Corresponde a: app/controllers/reservas_controller.py + app/routes/reservas_routes.py
// OJO: sin prefix único en el backend -> rutas mezcladas (/mis-reservas, /reservar, /reservas/{id})
import { api } from './httpClient';

export interface ReservaCreate {
  estacion_ocm_id: string;
  cargador_id?: string;
  estacion_nombre?: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
}

// El servidor fija costo_pagado y estado a partir del pago verificado.
export interface ReservaConfirmadaCreate extends ReservaCreate {
  transaccion_id: string;
}

export interface ReservaUpdate extends Partial<ReservaCreate> {}

export interface Reserva extends ReservaCreate {
  id: string;
  costo_pagado?: number;
  // pendiente | activa | en_curso (QR escaneado, cargando) | realizada | cancelada | rechazada
  estado?: string;
  reservante_nombre?: string;
  iniciada_en?: string | null;
  // "no_llego" cuando se canceló sola por no escanear el QR a tiempo.
  motivo_cancelacion?: string | null;
}

// Minutos que tiene el usuario para escanear el QR antes y después de la hora reservada
// (iguales a MINUTOS_ANTICIPACION_QR y MINUTOS_TOLERANCIA_LLEGADA del backend).
export const MINUTOS_ANTICIPACION_QR = 15;
export const MINUTOS_TOLERANCIA_LLEGADA = 30;

export interface RespuestaCarga {
  ok: boolean;
  mensaje: string;
  reserva: Reserva;
}

export async function misReservas(): Promise<Reserva[]> {
  const { data } = await api.get<Reserva[]>('/mis-reservas');
  return data;
}

export async function crearReserva(payload: ReservaCreate): Promise<Reserva> {
  const { data } = await api.post<Reserva>('/reservar', payload);
  return data;
}

export async function crearReservaConfirmada(payload: ReservaConfirmadaCreate): Promise<Reserva> {
  const { data } = await api.post<Reserva>('/reservar-confirmada', payload);
  return data;
}

export async function actualizarReserva(id: string, payload: ReservaUpdate): Promise<Reserva> {
  const { data } = await api.put<Reserva>(`/reservas/${id}`, payload);
  return data;
}

export async function cancelarReserva(id: string): Promise<{ ok: boolean; reembolso?: number; mensaje?: string }> {
  const { data } = await api.patch<{ ok: boolean; reembolso?: number; mensaje?: string }>(`/reservas/${id}/cancelar`);
  return data;
}

export async function eliminarReserva(id: string): Promise<void> {
  await api.delete(`/reservas/${id}`);
}

// `codigo` es el texto que leyó la cámara del QR o el código manual de 10 caracteres.
export async function escanearQr(id: string, codigo: string): Promise<RespuestaCarga> {
  const { data } = await api.post<RespuestaCarga>(`/reservas/${id}/escanear`, { codigo });
  return data;
}

export async function terminarCarga(id: string): Promise<RespuestaCarga> {
  const { data } = await api.post<RespuestaCarga>(`/reservas/${id}/terminar`);
  return data;
}
