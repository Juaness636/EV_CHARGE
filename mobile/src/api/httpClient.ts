// Cliente HTTP centralizado con Axios para React Native.
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Dirección IP local del computador en la red Wi-Fi (SENA): 10.4.246.21
const LOCAL_IP = '10.4.246.21';
const DEFAULT_URL = `http://${LOCAL_IP}:8000`;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Adjunta automáticamente el token guardado en AsyncStorage a cada petición
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const token = await AsyncStorage.getItem('ev_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('[HTTP] Error al leer el token de almacenamiento:', error);
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

// Normalización de errores de respuesta desde FastAPI
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail?: string }>) => {
    const status = error.response?.status ?? 0;
    const message = error.response?.data?.detail || error.message || 'Error de conexión con el servidor';

    if (status === 401) {
      try {
        await AsyncStorage.removeItem('ev_token');
      } catch {
        // Ignorar fallo al borrar
      }
    }

    return Promise.reject(new ApiError(message, status));
  },
);
