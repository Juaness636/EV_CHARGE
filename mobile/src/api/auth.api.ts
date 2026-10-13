// Corresponde a: app/controllers/auth_controller.py + app/routes/auth_routes.py
// y app/routes/olvidar_contraseña.py (recuperación con PIN por correo).
import { api, ApiError, guardarToken } from './httpClient';

export interface Usuario {
  id: string;
  nombre: string;
  apellido?: string;
  email: string;
  is_admin: boolean;
  compartir_nombre_reserva?: boolean;
  created_at: string;
  vehiculos_rel?: Array<{ autonomia_km?: number }>;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface PerfilOut {
  usuario: Usuario;
  vehiculo_activo: unknown | null;
}

// POST /auth/login — OAuth2PasswordRequestForm: va form-urlencoded, no JSON.
export async function login(email: string, password: string): Promise<TokenOut> {
  const form = `username=${encodeURIComponent(email.trim())}&password=${encodeURIComponent(password)}`;
  const { data } = await api.post<TokenOut>('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  await guardarToken(data.access_token);
  return data;
}

export async function registro(nombre: string, apellido: string, email: string, password: string): Promise<TokenOut> {
  const { data } = await api.post<TokenOut>('/auth/registro', {
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: email.trim(),
    password,
  });
  return data;
}

export async function obtenerPerfil(): Promise<PerfilOut> {
  const { data } = await api.get<PerfilOut>('/auth/perfil');
  return data;
}

export async function actualizarPerfil(payload: {
  nombre?: string;
  apellido?: string;
  email?: string;
  compartir_nombre_reserva?: boolean;
}): Promise<{ usuario: Usuario }> {
  const { data } = await api.put<{ usuario: Usuario }>('/auth/perfil', payload);
  return data;
}

export async function cambiarPassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  const { data } = await api.put<{ ok: boolean }>('/auth/password', {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

export async function logout(): Promise<void> {
  await guardarToken(null);
}

// Recuperación de contraseña: correo -> PIN de 6 dígitos -> token -> nueva contraseña.
export async function solicitarCodigoRecuperacion(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/api/auth/forgot-password', { email: email.trim() });
  return data;
}

export async function verificarPinRecuperacion(email: string, pin: string): Promise<{ reset_token: string }> {
  const { data } = await api.post<{ reset_token: string }>('/api/auth/verify-pin', { email: email.trim(), pin });
  return data;
}

export async function restablecerPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/api/auth/reset-password', { token, new_password: newPassword });
  return data;
}

export { ApiError };
