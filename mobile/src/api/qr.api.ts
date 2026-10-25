// Corresponde a: app/routes/qr_routes.py + app/services/qr_service.py
import { Linking, Platform } from 'react-native';
import { api, API_BASE_URL } from './httpClient';

export interface QrCargador {
  numero: number;
  referencia: string;
  tipo?: string | null;
  potencia_kw?: number | null;
  // Texto del QR (firmado por el servidor) y el código manual que se imprime debajo.
  contenido: string;
  codigo: string;
  imagen: string; // PNG en data URI
}

export interface QrEstacion {
  estacion_id: string;
  nombre: string;
  direccion: string;
  cargadores: QrCargador[];
  // Ruta relativa con un permiso de 15 minutos para abrir la hoja imprimible.
  hoja_url: string;
}

export async function qrEstacion(estacionId: string, como: 'admin' | 'empresa'): Promise<QrEstacion> {
  const { data } = await api.get<QrEstacion>(`/${como}/estaciones/${encodeURIComponent(estacionId)}/qr`);
  return data;
}

// Abre la hoja con todos los QR en el navegador, lista para imprimir o guardar como PDF.
export async function abrirHojaQr(hojaUrl: string): Promise<void> {
  const url = `${API_BASE_URL}${hojaUrl}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener');
    return;
  }
  await Linking.openURL(url);
}
