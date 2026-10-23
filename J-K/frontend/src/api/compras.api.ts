// Corresponde a: app/routes/compras_routes.py (comprador) y app/routes/admin_compras_routes.py (admin).
import { api } from './httpClient';

export type EstadoPedido = 'pendiente' | 'confirmado' | 'enviado' | 'entregado' | 'cancelado';

export const ESTADOS_PEDIDO: Array<{ valor: EstadoPedido; etiqueta: string }> = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'confirmado', etiqueta: 'Confirmado' },
  { valor: 'enviado', etiqueta: 'Enviado' },
  { valor: 'entregado', etiqueta: 'Entregado' },
  { valor: 'cancelado', etiqueta: 'Cancelado' },
];

export const etiquetaPedido = (estado?: string) => ESTADOS_PEDIDO.find((e) => e.valor === estado)?.etiqueta ?? 'Pendiente';
export const pedidoCerrado = (estado?: string) => estado === 'entregado' || estado === 'cancelado';

export interface EnvioCompra {
  contacto_nombre: string;
  contacto_telefono: string;
  direccion_envio: string;
  ciudad: string;
  notas_cliente?: string;
}

export interface MensajeCompra {
  id: string;
  es_admin: boolean;
  texto: string;
  created_at: string;
}

export interface Compra extends Partial<EnvioCompra> {
  id: string;
  producto: string;
  cantidad: number;
  monto: number;
  metodo: string;
  metodo_id?: string | null;
  transaccion_id: string;
  estado: string;
  estado_pedido: EstadoPedido;
  created_at: string;
  updated_at?: string | null;
  mensajes_sin_leer: number;
}

export interface CompraDetalle extends Compra {
  mensajes: MensajeCompra[];
}

export interface CompraAdmin extends Compra {
  comprador?: { id: string; nombre: string; apellido?: string | null; email: string } | null;
}

export interface CompraAdminDetalle extends CompraAdmin {
  mensajes: MensajeCompra[];
}

export async function listarCompras(): Promise<Compra[]> {
  const { data } = await api.get<Compra[]>('/compras');
  return data;
}

export async function obtenerCompra(id: string): Promise<CompraDetalle> {
  const { data } = await api.get<CompraDetalle>(`/compras/${id}`);
  return data;
}

export async function enviarMensajeCompra(id: string, texto: string): Promise<MensajeCompra> {
  const { data } = await api.post<MensajeCompra>(`/compras/${id}/mensajes`, { texto });
  return data;
}

export async function listarComprasAdmin(filtros: { estado_pedido?: EstadoPedido; busqueda?: string } = {}): Promise<CompraAdmin[]> {
  const { data } = await api.get<CompraAdmin[]>('/admin/compras', { params: filtros });
  return data;
}

export async function obtenerCompraAdmin(id: string): Promise<CompraAdminDetalle> {
  const { data } = await api.get<CompraAdminDetalle>(`/admin/compras/${id}`);
  return data;
}

export async function cambiarEstadoPedido(id: string, estado_pedido: EstadoPedido): Promise<CompraAdminDetalle> {
  const { data } = await api.patch<CompraAdminDetalle>(`/admin/compras/${id}/estado`, { estado_pedido });
  return data;
}

export async function enviarMensajeCompraAdmin(id: string, texto: string): Promise<MensajeCompra> {
  const { data } = await api.post<MensajeCompra>(`/admin/compras/${id}/mensajes`, { texto });
  return data;
}
