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
});

// Adjunta el token guardado en localStorage a cada request saliente.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ev_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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

// Normaliza cualquier error de Axios a ApiError, usando el `detail` que manda FastAPI.
// Si el token expiró (401) lo limpia para forzar login de nuevo.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const status = error.response?.status ?? 0;
    const message = error.response?.data?.detail || error.message || 'Error en la solicitud';

    if (status === 401) {
      localStorage.removeItem('ev_token');
    }

    return Promise.reject(new ApiError(message, status));
  },
);
