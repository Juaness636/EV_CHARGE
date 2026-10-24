// Cliente HTTP centralizado con Axios.
// Todos los archivos en src/api/*.api.ts deben usar `api` (esta instancia), nunca fetch directo.

import axios, { type AxiosError } from 'axios';

// Cuando la app se abre desde otro dispositivo de la red (por ejemplo el
// celular), 127.0.0.1 apunta al propio dispositivo y no al computador que
// ejecuta FastAPI. En ese caso usamos automáticamente el mismo host del
// frontend y el puerto del backend.
const browserHost = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
const runtimeApiUrl = browserHost && browserHost !== 'localhost' && browserHost !== '127.0.0.1'
  ? `http://${browserHost}:8000`
  : 'http://127.0.0.1:8000';
const developmentProxyUrl = import.meta.env.DEV ? '/backend' : runtimeApiUrl;

const configuredApiUrl = import.meta.env.VITE_API_URL;
// En un dispositivo remoto siempre prevalece el host del navegador, aunque
// exista una variable local apuntando a 127.0.0.1.
export const API_BASE_URL = browserHost !== 'localhost' && browserHost !== '127.0.0.1'
  ? developmentProxyUrl
  : (import.meta.env.DEV ? developmentProxyUrl : configuredApiUrl || runtimeApiUrl);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// Adjunta el token guardado en localStorage a cada request saliente.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ev_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Causa del error, para mostrar un mensaje distinto en cada caso.
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

// Evento que escucha AuthContext para cerrar la sesión vencida y volver al inicio.
export const EVENTO_SESION_VENCIDA = 'ev-charge:sesion-vencida';

const MENSAJES: Record<TipoError, string> = {
  sin_internet: 'No tienes conexión a internet. Revisa tu red e inténtalo de nuevo.',
  servidor_caido: 'No pudimos comunicarnos con el servidor de EV Charge. Puede estar apagado o en mantenimiento; inténtalo en unos minutos.',
  tiempo_agotado: 'El servidor tardó demasiado en responder. Inténtalo de nuevo.',
  sesion_vencida: 'Tu sesión venció. Inicia sesión de nuevo para continuar.',
  sin_permisos: 'No tienes permiso para realizar esta acción.',
  no_encontrado: 'No encontramos lo que buscas. Puede que ya no exista.',
  validacion: 'Revisa los datos que escribiste e inténtalo de nuevo.',
  demasiados_intentos: 'Hiciste demasiados intentos. Espera un momento e inténtalo de nuevo.',
  inesperado: 'Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.',
};

// Textos genéricos en inglés que no deben llegar a la pantalla.
const TEXTO_TECNICO = /internal server error|not found|method not allowed|not authenticated|forbidden|unauthorized|network error|timeout/i;

// El backend responde {mensaje, detail}; `detail` puede ser texto o la lista de errores de validación.
function mensajeBackend(datos?: { mensaje?: unknown; detail?: unknown }): string | null {
  if (typeof datos?.mensaje === 'string' && datos.mensaje.trim()) return datos.mensaje;
  const detail = datos?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const primero = detail[0] as { msg?: string };
    if (primero?.msg && /^Value error, /i.test(primero.msg)) return primero.msg.replace(/^Value error, /i, '');
  }
  return null;
}

function clasificar(error: AxiosError<{ mensaje?: unknown; detail?: unknown }>): TipoError {
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message)) return 'tiempo_agotado';
    return navigator.onLine === false ? 'sin_internet' : 'servidor_caido';
  }
  const status = error.response.status;
  if (status === 401) return error.config?.url?.includes('/auth/login') ? 'validacion' : 'sesion_vencida';
  if (status === 403) return 'sin_permisos';
  if (status === 404) return 'no_encontrado';
  if (status === 429) return 'demasiados_intentos';
  if (status === 502 || status === 503 || status === 504) return mensajeBackend(error.response.data) ? 'inesperado' : 'servidor_caido';
  if (status >= 500) return 'inesperado';
  return 'validacion';
}

// Normaliza cualquier error de Axios a ApiError con un mensaje claro según la causa.
// Si la sesión venció (401) limpia el token y avisa para volver a iniciar sesión.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ mensaje?: unknown; detail?: unknown }>) => {
    const status = error.response?.status ?? 0;
    const tipo = clasificar(error);
    const propio = mensajeBackend(error.response?.data);
    const usarPropio = propio && !TEXTO_TECNICO.test(propio) && status > 0 && status < 500 && tipo !== 'sesion_vencida';
    const message = usarPropio || (status === 503 && propio && !TEXTO_TECNICO.test(propio)) ? propio! : MENSAJES[tipo];

    if (tipo === 'sesion_vencida' && localStorage.getItem('ev_token')) {
      localStorage.removeItem('ev_token');
      window.dispatchEvent(new CustomEvent(EVENTO_SESION_VENCIDA));
    }

    return Promise.reject(new ApiError(message, status, tipo));
  },
);
