// Cliente HTTP centralizado. Reemplaza las funciones sueltas tipo
// `apiFetchIndex` que hoy viven repetidas en index.html/mapa.html/dashboard.
//
// Todos los archivos en src/api/*.api.ts deben usar `apiFetch`, nunca `fetch` directo.

export const API_BASE_URL = 'http://127.0.0.1:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('ev_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  // /auth/login responde 200 sin cuerpo JSON en algunos casos raros; se maneja aparte si hace falta
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.detail || 'Error en la solicitud', response.status);
  }

  return data as T;
}
