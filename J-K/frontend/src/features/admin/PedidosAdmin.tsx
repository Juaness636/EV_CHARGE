// Gestión de pedidos de productos: estado del envío, datos del comprador y conversación con él.
import { useEffect, useState } from 'react';
import {
  cambiarEstadoPedido, enviarMensajeCompraAdmin, ESTADOS_PEDIDO, etiquetaPedido, listarComprasAdmin, obtenerCompraAdmin,
  pedidoCerrado, type CompraAdmin, type CompraAdminDetalle, type EstadoPedido,
} from '../../api/compras.api';
import { notificar } from '../../components/GlobalNotifications';
import { ConversacionPedido } from '../pedidos/ConversacionPedido';
import '../pedidos/pedidos.css';

const pesos = (valor: number) => `$${Number(valor || 0).toLocaleString('es-CO')} COP`;
const fecha = (valor?: string | null) => (valor ? new Date(valor).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha');
const nombreComprador = (c: CompraAdmin) => (c.comprador ? `${c.comprador.nombre} ${c.comprador.apellido ?? ''}`.trim() : 'Usuario eliminado');
const errorDe = (e: unknown) => (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  || (e instanceof Error ? e.message : 'No se pudo completar la operación.');
// WhatsApp necesita el número con indicativo; los celulares colombianos de 10 dígitos se completan con 57.
const numeroWhatsApp = (telefono: string) => {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 10 ? `57${digitos}` : digitos;
};

export function PedidosAdmin() {
  const [pedidos, setPedidos] = useState<CompraAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todos' | EstadoPedido>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<CompraAdminDetalle | null>(null);

  const cargar = async () => {
    try {
      setError('');
      setPedidos(await listarComprasAdmin());
    } catch (e) {
      setError(errorDe(e));
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { void cargar(); }, []);

  const texto = busqueda.trim().toLowerCase();
  const filas = pedidos.filter((p) => (filtro === 'todos' || p.estado_pedido === filtro)
    && (!texto || [p.producto, p.transaccion_id, p.ciudad, p.contacto_nombre, nombreComprador(p), p.comprador?.email].some((v) => (v ?? '').toLowerCase().includes(texto))));
  const contar = (estado: EstadoPedido) => pedidos.filter((p) => p.estado_pedido === estado).length;

  const abrir = async (id: string) => {
    try {
      setDetalle(await obtenerCompraAdmin(id));
      void cargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'No se pudo abrir el pedido', mensaje: errorDe(e) });
    }
  };

  const cambiarEstado = async (estado: EstadoPedido) => {
    if (!detalle || estado === detalle.estado_pedido) return;
    if (pedidoCerrado(estado) && !window.confirm('Un pedido entregado o cancelado ya no se puede cambiar. ¿Deseas continuar?')) return;
    try {
      setDetalle(await cambiarEstadoPedido(detalle.id, estado));
      notificar({ tipo: 'success', titulo: 'Pedido actualizado', mensaje: 'El comprador recibió una notificación con el nuevo estado.' });
      void cargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Operación no completada', mensaje: errorDe(e) });
    }
  };

  if (cargando) return <p className="empty">Cargando...</p>;

  return <>
    {error && <div className="alert alert-error">{error}</div>}
    <div className="kpi-grid">
      <div className="kpi-card"><div className="kpi-icon">Por confirmar</div><div className="kpi-num">{contar('pendiente')}</div></div>
      <div className="kpi-card"><div className="kpi-icon">En camino</div><div className="kpi-num">{contar('confirmado') + contar('enviado')}</div></div>
      <div className="kpi-card"><div className="kpi-icon">Entregados</div><div className="kpi-num">{contar('entregado')}</div></div>
      <div className="kpi-card"><div className="kpi-icon">Mensajes sin leer</div><div className="kpi-num">{pedidos.reduce((t, p) => t + p.mensajes_sin_leer, 0)}</div></div>
    </div>
    <div className="panel-toolbar">
      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por producto, comprador, ciudad o transacción" />
      <div className="filter-pills">
        {(['todos', ...ESTADOS_PEDIDO.map((e) => e.valor)] as const).map((estado) => (
          <button key={estado} className={`pill ${filtro === estado ? 'active' : ''}`} onClick={() => setFiltro(estado)}>{estado === 'todos' ? 'Todos' : etiquetaPedido(estado)}</button>
        ))}
      </div>
    </div>
    <div className="table-wrap"><table>
      <thead><tr><th>Pedido</th><th>Comprador</th><th>Envío</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        {filas.map((p) => <tr key={p.id}>
          <td><strong>{p.producto}{p.cantidad > 1 ? ` × ${p.cantidad}` : ''}</strong><br /><small>{pesos(p.monto)} · {fecha(p.created_at)}</small></td>
          <td>{nombreComprador(p)}<br /><small>{p.comprador?.email}</small></td>
          <td>{p.direccion_envio ? <>{p.direccion_envio}<br /><small>{p.ciudad} · {p.contacto_telefono}</small></> : <small>Sin dirección registrada</small>}</td>
          <td><span className={`estado-pedido ${p.estado_pedido}`}>{etiquetaPedido(p.estado_pedido)}</span></td>
          <td><button className="btn-tbl" onClick={() => void abrir(p.id)}>Gestionar{p.mensajes_sin_leer > 0 && <span className="pedido-sin-leer">{p.mensajes_sin_leer}</span>}</button></td>
        </tr>)}
        {!filas.length && <tr><td className="empty" colSpan={5}>No hay pedidos para este filtro.</td></tr>}
      </tbody>
    </table></div>

    {detalle && <div className="pedido-detalle">
      <div className="pedido-acciones" style={{ justifyContent: 'space-between' }}>
        <h3>Pedido · {detalle.producto}{detalle.cantidad > 1 ? ` × ${detalle.cantidad}` : ''}</h3>
        <button className="btn-tbl" onClick={() => setDetalle(null)}>Cerrar</button>
      </div>
      <div className="pedido-grid">
        <div>
          <p><strong>Transacción:</strong> {detalle.transaccion_id}</p>
          <p><strong>Total pagado:</strong> {pesos(detalle.monto)} · {detalle.metodo}</p>
          <p><strong>Fecha:</strong> {fecha(detalle.created_at)}</p>
          <label>Estado del pedido{' '}
            <select value={detalle.estado_pedido} disabled={pedidoCerrado(detalle.estado_pedido)} onChange={(e) => void cambiarEstado(e.target.value as EstadoPedido)}>
              {ESTADOS_PEDIDO.map((e) => <option key={e.valor} value={e.valor}>{e.etiqueta}</option>)}
            </select>
          </label>
        </div>
        <div>
          <p><strong>Cuenta:</strong> {nombreComprador(detalle)} · {detalle.comprador?.email}</p>
          {detalle.direccion_envio ? <>
            <p><strong>Recibe:</strong> {detalle.contacto_nombre} · {detalle.contacto_telefono}</p>
            <p><strong>Dirección:</strong> {detalle.direccion_envio}, {detalle.ciudad}</p>
            {detalle.notas_cliente && <p><strong>Indicaciones:</strong> {detalle.notas_cliente}</p>}
          </> : <p className="empty">Este pedido es anterior a los datos de envío. Pide la dirección al comprador por mensaje.</p>}
          <div className="pedido-acciones">
            {detalle.contacto_telefono && <>
              <a className="btn-tbl" href={`tel:${detalle.contacto_telefono}`}>Llamar</a>
              <a className="btn-tbl" target="_blank" rel="noreferrer" href={`https://wa.me/${numeroWhatsApp(detalle.contacto_telefono)}?text=${encodeURIComponent(`Hola ${detalle.contacto_nombre}, te escribimos de EV Charge sobre tu pedido de ${detalle.producto}.`)}`}>WhatsApp</a>
            </>}
            {detalle.comprador?.email && <a className="btn-tbl" href={`mailto:${detalle.comprador.email}?subject=${encodeURIComponent(`Tu pedido de ${detalle.producto} (${detalle.transaccion_id})`)}`}>Correo</a>}
          </div>
        </div>
      </div>
      <ConversacionPedido
        vistaAdmin
        mensajes={detalle.mensajes}
        onEnviar={async (t) => {
          const mensaje = await enviarMensajeCompraAdmin(detalle.id, t);
          setDetalle((d) => (d ? { ...d, mensajes: [...d.mensajes, mensaje] } : d));
        }}
      />
    </div>}
  </>;
}
