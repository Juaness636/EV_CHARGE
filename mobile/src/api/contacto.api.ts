// Servicio de Contacto para React Native
import { api } from './httpClient';
import type { Contacto } from '../types';

export async function enviarContacto(payload: {
  nombre: string;
  apellido: string;
  correo: string;
  mensaje: string;
}): Promise<Contacto> {
  const { data } = await api.post<Contacto>('/contacto', payload);
  return data;
}
