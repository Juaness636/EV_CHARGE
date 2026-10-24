// Corresponde a: app/routes/pagos.py (POST /api/pagos/procesar).
// Procesa el pago simulado de productos o reservas.
import { api } from './httpClient';
import type { EnvioCompra } from './compras.api';
import type { ReservaCreate } from './reservas.api';

export interface PagoCreate {
  tipo_pago: 'producto' | 'reserva';
  item: string;
  monto: number;
  metodo: string;
  metodo_id?: string;
  referencia_id: string;
  // Solo compras: el servidor recalcula el total con su catálogo y exige los datos de envío.
  cantidad?: number;
  envio?: EnvioCompra;
  // Obligatoria en pagos de reserva: el backend calcula el precio y ata el pago a esta reserva.
  reserva?: ReservaCreate;
}

// En pagos de reserva, transaccion_id es lo que /reservar-confirmada exige como prueba de pago.
export async function procesarPago(payload: PagoCreate): Promise<{ transaccion_id: string }> {
  const { data } = await api.post<{ transaccion_id: string }>('/api/pagos/procesar', payload);
  return data;
}
