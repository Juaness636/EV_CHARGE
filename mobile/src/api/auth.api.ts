// Servicios de Autenticación para React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './httpClient';
import type { Usuario, TokenOut, PerfilOut } from '../types';

// POST /auth/login (form-urlencoded)
export async function login(email: string, pass: string): Promise<TokenOut> {
  const form = new URLSearchParams();
  form.append('username', email.trim());
  form.append('password', pass);

  const { data } = await api.post<TokenOut>('/auth/login', form.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (data?.access_token) {
    await AsyncStorage.setItem('ev_token', data.access_token);
  }

  return data;
}

// POST /auth/registro
export async function registro(
  nombre: string,
  apellido: string,
  email: string,
  password: string,
): Promise<TokenOut> {
  const { data } = await api.post<TokenOut>('/auth/registro', {
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: email.trim(),
    password,
  });
  return data;
}

// GET /auth/perfil
export async function obtenerPerfil(): Promise<PerfilOut> {
  const { data } = await api.get<PerfilOut>('/auth/perfil');
  return data;
}

// PUT /auth/perfil
export async function actualizarPerfil(payload: {
  nombre?: string;
  apellido?: string;
  email?: string;
  compartir_nombre_reserva?: boolean;
}): Promise<{ usuario: Usuario }> {
  const { data } = await api.put<{ usuario: Usuario }>('/auth/perfil', payload);
  return data;
}

// Limpiar sesión local
export async function logout(): Promise<void> {
  try {
    await AsyncStorage.removeItem('ev_token');
  } catch (error) {
    console.warn('[AUTH] Error al limpiar token:', error);
  }
}

export { ApiError };
