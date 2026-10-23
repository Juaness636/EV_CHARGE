// Cliente HTTP centralizado (Axios) para Android, iOS y Web.
// Todos los archivos src/api/*.api.ts deben usar `api`, nunca fetch directo.
import axios, { type AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PUERTO_BACKEND = 8000;
export const CLAVE_TOKEN = 'ev_token';

// Resuelve la URL del backend FastAPI en este orden:
// 1. EXPO_PUBLIC_API_URL (si se define en mobile/.env).
// 2. Web: el mismo host desde el que se abrió la página (localhost o la IP del PC).
// 3. Expo Go / build de desarrollo: la IP del computador que ejecuta `expo start`
//    (hostUri), así el celular encuentra el backend sin escribir la IP a mano.
// 4. Emulador Android sin hostUri: 10.0.2.2 apunta al computador anfitrión.
function resolverApiUrl(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configurada) return configurada.replace(/\/+$/, '');

  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host || 'localhost'}:${PUERTO_BACKEND}`;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? '';
  const hostExpo = hostUri.split(':')[0];
  if (hostExpo && !hostExpo.includes('exp.direct')) return `http://${hostExpo}:${PUERTO_BACKEND}`;

  return Platform.OS === 'android' ? `http://10.0.2.2:${PUERTO_BACKEND}` : `http://localhost:${PUERTO_BACKEND}`;
}

export const API_BASE_URL = resolverApiUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// El token se mantiene en memoria para no leer AsyncStorage en cada petición.
let tokenEnMemoria: string | null = null;
let tokenCargado = false;

export async function obtenerToken(): Promise<string | null> {
  if (!tokenCargado) {
    try {
      tokenEnMemoria = await AsyncStorage.getItem(CLAVE_TOKEN);
    } catch {
      tokenEnMemoria = null;
    }
    tokenCargado = true;
  }
  return tokenEnMemoria;
}

export async function guardarToken(token: string | null): Promise<void> {
  tokenEnMemoria = token;
  tokenCargado = true;
  try {
    if (token) await AsyncStorage.setItem(CLAVE_TOKEN, token);
    else await AsyncStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // El almacenamiento puede no estar disponible (modo privado del navegador).
  }
}

// Permite que el AuthContext cierre la sesión cuando el backend responde 401.
type ListenerSesion = () => void;
const listenersSesionExpirada = new Set<ListenerSesion>();
export function onSesionExpirada(listener: ListenerSesion): () => void {
  listenersSesionExpirada.add(listener);
  return () => listenersSesionExpirada.delete(listener);
}

api.interceptors.request.use(async (config) => {
  const token = await obtenerToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.status = status;
  }
}

// FastAPI devuelve `detail` como texto o como lista de errores de validación.
function mensajeDetalle(detail: unknown): string | null {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    const primero = detail[0] as { msg?: string };
    if (primero?.msg) return primero.msg.replace(/^Value error, /i, '');
  }
  return null;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail?: unknown }>) => {
    const status = error.response?.status ?? 0;
    const sinConexion = !error.response;
    const message = sinConexion
      ? `No se pudo conectar con el servidor (${API_BASE_URL}). Verifica que el backend esté activo y en la misma red.`
      : mensajeDetalle(error.response?.data?.detail) || error.message || 'Error en la solicitud';

    const esLogin = error.config?.url?.includes('/auth/login');
    if (status === 401 && !esLogin && tokenEnMemoria) {
      await guardarToken(null);
      listenersSesionExpirada.forEach((listener) => listener());
    }

    return Promise.reject(new ApiError(message, status));
  },
);

export function mensajeError(error: unknown, porDefecto = 'No se pudo completar la operación'): string {
  return error instanceof Error && error.message ? error.message : porDefecto;
}
