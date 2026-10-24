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

// Causa del error, para mostrar un mensaje y una pantalla distintos en cada caso.
export type TipoError =
  | 'sin_internet' | 'servidor_caido' | 'tiempo_agotado' | 'sesion_vencida' | 'sin_permisos'
  | 'no_encontrado' | 'validacion' | 'demasiados_intentos' | 'inesperado';

export class ApiError extends Error {
  status: number;
  tipo: TipoError;
  constructor(message: string, status: number, tipo: TipoError = 'inesperado') {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
    this.status = status;
    this.tipo = tipo;
  }
}

// Mensajes pensados para el usuario final: sin URLs, códigos ni nombres técnicos.
export const MENSAJE_SIN_CONEXION = 'No tienes conexión a internet. Revisa tu Wi-Fi o tus datos móviles e inténtalo de nuevo.';
const MENSAJE_SERVIDOR_CAIDO = 'No pudimos comunicarnos con el servidor de EV Charge. Puede estar apagado o en mantenimiento; inténtalo en unos minutos.';
const MENSAJE_TARDANZA = 'El servidor tardó demasiado en responder. Revisa tu conexión e inténtalo de nuevo.';
const MENSAJE_SERVIDOR = 'Ocurrió un error inesperado en el servidor. Inténtalo de nuevo en unos minutos.';
const MENSAJE_DATOS = 'Revisa los datos que escribiste e inténtalo de nuevo.';
const MENSAJE_SESION = 'Tu sesión venció. Inicia sesión de nuevo para continuar.';
const MENSAJE_PERMISOS = 'No tienes permiso para realizar esta acción.';
const MENSAJE_NO_ENCONTRADO = 'No encontramos lo que buscas. Puede que ya no exista.';
const MENSAJE_INTENTOS = 'Hiciste demasiados intentos. Espera un momento e inténtalo de nuevo.';

// Sin respuesta del backend: se distingue "no hay internet" de "el servidor no contesta"
// probando una dirección pública muy liviana.
async function hayInternet(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  const control = new AbortController();
  const espera = setTimeout(() => control.abort(), 3500);
  try {
    await fetch('https://clients3.google.com/generate_204', {
      method: 'GET', cache: 'no-store', signal: control.signal,
      ...(Platform.OS === 'web' ? { mode: 'no-cors' as RequestMode } : {}),
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(espera);
  }
}

// El backend responde {mensaje, detail}; `detail` puede ser texto o la lista de errores de validación.
// De la lista solo se muestran los mensajes propios del backend ("Value error, ..."),
// los de Pydantic vienen en inglés y no le dicen nada al usuario.
function mensajeDetalle(datos?: { mensaje?: unknown; detail?: unknown }): string | null {
  if (typeof datos?.mensaje === 'string' && datos.mensaje.trim()) return datos.mensaje;
  const detail = datos?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const primero = detail[0] as { msg?: string };
    if (primero?.msg && /^Value error, /i.test(primero.msg)) return primero.msg.replace(/^Value error, /i, '');
    return MENSAJE_DATOS;
  }
  return null;
}

// Textos genéricos en inglés que no deben llegar a la pantalla.
const TEXTO_TECNICO = /internal server error|not found|method not allowed|not authenticated|forbidden|unauthorized/i;

async function clasificar(error: AxiosError<{ mensaje?: unknown; detail?: unknown }>): Promise<{ tipo: TipoError; message: string }> {
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) return { tipo: 'tiempo_agotado', message: MENSAJE_TARDANZA };
    return (await hayInternet())
      ? { tipo: 'servidor_caido', message: MENSAJE_SERVIDOR_CAIDO }
      : { tipo: 'sin_internet', message: MENSAJE_SIN_CONEXION };
  }
  const status = error.response.status;
  const propio = mensajeDetalle(error.response.data);
  const texto = (porDefecto: string) => (propio && !TEXTO_TECNICO.test(propio) ? propio : porDefecto);
  const esLogin = error.config?.url?.includes('/auth/login');

  if (status === 401) return esLogin ? { tipo: 'validacion', message: texto('Correo o contraseña incorrectos.') } : { tipo: 'sesion_vencida', message: MENSAJE_SESION };
  if (status === 403) return { tipo: 'sin_permisos', message: texto(MENSAJE_PERMISOS) };
  if (status === 404) return { tipo: 'no_encontrado', message: texto(MENSAJE_NO_ENCONTRADO) };
  if (status === 429) return { tipo: 'demasiados_intentos', message: texto(MENSAJE_INTENTOS) };
  if (status === 502 || status === 503 || status === 504) {
    // Un 503 con texto propio ("No se pudo enviar el código...") sí se muestra.
    return propio && !TEXTO_TECNICO.test(propio) ? { tipo: 'inesperado', message: propio } : { tipo: 'servidor_caido', message: MENSAJE_SERVIDOR_CAIDO };
  }
  if (status >= 500) return { tipo: 'inesperado', message: MENSAJE_SERVIDOR };
  return { tipo: 'validacion', message: texto(status === 422 ? MENSAJE_DATOS : 'No se pudo completar la operación.') };
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ mensaje?: unknown; detail?: unknown }>) => {
    const status = error.response?.status ?? 0;
    if (!error.response && __DEV__) {
      // El detalle técnico queda en la consola de Expo para quien desarrolla, no en pantalla.
      console.warn(`[api] Sin respuesta de ${API_BASE_URL}${error.config?.url ?? ''}: ${error.code ?? ''} ${error.message}`);
    }
    const { tipo, message } = await clasificar(error);

    if (tipo === 'sesion_vencida' && tokenEnMemoria) {
      await guardarToken(null);
      listenersSesionExpirada.forEach((listener) => listener());
    }

    return Promise.reject(new ApiError(message, status, tipo));
  },
);

// Verdadero cuando el problema es la conexión (no los datos): sin internet, servidor caído o tiempo agotado.
export function esFalloDeConexion(error: unknown): boolean {
  return error instanceof ApiError && ['sin_internet', 'servidor_caido', 'tiempo_agotado'].includes(error.tipo);
}

export function mensajeError(error: unknown, porDefecto = 'No se pudo completar la operación'): string {
  return error instanceof Error && error.message ? error.message : porDefecto;
}
