// Corresponde a: app/routes/pagos.py (POST /api/pagos/procesar).
// Procesa el pago simulado de productos o reservas.
import { api } from './httpClient';

export interface PagoCreate {
  tipo_pago: 'producto' | 'reserva';
  item: string;
  monto: number;
  metodo: string;
  metodo_id?: string;
  referencia_id: string;
}

export async function procesarPago(payload: PagoCreate): Promise<unknown> {
  const { data } = await api.post('/api/pagos/procesar', payload);
  return data;
}
