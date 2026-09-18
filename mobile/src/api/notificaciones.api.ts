// Servicio de Notificaciones para React Native
import { api } from './httpClient';
import type { Notificacion } from '../types';

export async function listarNotificaciones(): Promise<Notificacion[]> {
  const { data } = await api.get<Notificacion[]>('/notificaciones');
  return data;
}

export async function marcarNotificacionesLeidas(): Promise<void> {
  await api.patch('/notificaciones/leidas');
}

export async function eliminarNotificacion(id: string): Promise<void> {
  await api.delete(`/notificaciones/${id}`);
}
