// Gestión de pedidos de productos: estado del envío, datos del comprador y conversación con él.
import React, { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import {
  cambiarEstadoPedido, enviarMensajeCompraAdmin, ESTADOS_PEDIDO, etiquetaPedido, listarComprasAdmin, obtenerCompraAdmin,
  pedidoCerrado, type CompraAdmin, type CompraAdminDetalle, type EstadoPedido,
} from '../../../api/compras.api';
import { mensajeError } from '../../../api/httpClient';
import { useTheme } from '../../../theme/ThemeContext';
import { fechaHora, pesos } from '../../../utils/formato';
import { useCarga } from '../../../utils/useCarga';
import { confirmar, notificar } from '../../../components/Notificaciones';
import { ConversacionPedido } from '../../../components/ConversacionPedido';
import { Alerta, AppModal, Boton, CampoSelect, CampoTexto, Cargando, Chips, Dato, Insignia, ItemLista, KPI, tonoEstado, Vacio } from '../../../components/ui';
import type { PropsAdmin } from './AdminPaneles';

type Filtro = 'todos' | EstadoPedido;

const nombreComprador = (c: CompraAdmin) =>
  c.comprador ? `${c.comprador.nombre} ${c.comprador.apellido ?? ''}`.trim() : 'Usuario eliminado';

// WhatsApp necesita el número con indicativo; los celulares colombianos de 10 dígitos se completan con 57.
const numeroWhatsApp = (telefono: string) => {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 10 ? `57${digitos}` : digitos;
};

function abrir(url: string) {
  Linking.openURL(url).catch(() => notificar({ tipo: 'error', titulo: 'No se pudo abrir', mensaje: 'Este dispositivo no tiene una aplicación para esta acción.' }));
}

export function PedidosAdmin({ version }: PropsAdmin) {
  const { colors } = useTheme();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const { datos: pedidos, cargando, error, recargar } = useCarga(() => listarComprasAdmin(), [] as CompraAdmin[], [version]);
  const [detalle, setDetalle] = useState<CompraAdminDetalle | null>(null);

  const texto = busqueda.trim().toLowerCase();
  const filas = pedidos.filter((p) =>
    (filtro === 'todos' || p.estado_pedido === filtro)
    && (!texto || [p.producto, p.transaccion_id, p.ciudad, p.contacto_nombre, nombreComprador(p), p.comprador?.email].some((v) => (v ?? '').toLowerCase().includes(texto))));
  const contar = (estado: EstadoPedido) => pedidos.filter((p) => p.estado_pedido === estado).length;
  const sinLeer = pedidos.reduce((t, p) => t + p.mensajes_sin_leer, 0);

  const abrirDetalle = async (id: string) => {
    try {
      setDetalle(await obtenerCompraAdmin(id));
      void recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'No se pudo abrir el pedido', mensaje: mensajeError(e) });
    }
  };

  const cambiarEstado = async (estado: EstadoPedido) => {
    if (!detalle || estado === detalle.estado_pedido) return;
    if (pedidoCerrado(estado) && !(await confirmar({
      titulo: `Marcar como ${etiquetaPedido(estado).toLowerCase()}`,
      mensaje: 'Un pedido entregado o cancelado ya no se puede cambiar. ¿Deseas continuar?',
      confirmarTexto: 'Confirmar',
    }))) return;
    try {
      setDetalle(await cambiarEstadoPedido(detalle.id, estado));
      notificar({ tipo: 'success', titulo: 'Pedido actualizado', mensaje: 'El comprador recibió una notificación con el nuevo estado.' });
      void recargar();
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Operación no completada', mensaje: mensajeError(e) });
    }
  };

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <KPI etiqueta="Por confirmar" valor={contar('pendiente')} icono="hourglass-half" />
        <KPI etiqueta="En camino" valor={contar('confirmado') + contar('enviado')} icono="truck" />
        <KPI etiqueta="Entregados" valor={contar('entregado')} icono="box-open" />
        <KPI etiqueta="Mensajes sin leer" valor={sinLeer} icono="comments" />
      </View>
      <CampoTexto icono="magnifying-glass" value={busqueda} onChangeText={setBusqueda} placeholder="Buscar por producto, comprador, ciudad o transacción" />
      <Chips valor={filtro} onChange={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos' }, ...ESTADOS_PEDIDO]} />
      {error ? <Alerta texto={error} /> : null}
      {cargando && !pedidos.length ? <Cargando /> : filas.length === 0 ? <Vacio texto="No hay pedidos para este filtro." icono="box-open" /> : filas.map((p) => (
        <ItemLista
          key={p.id}
          titulo={p.cantidad > 1 ? `${p.producto} × ${p.cantidad}` : p.producto}
          insignia={<Insignia texto={etiquetaPedido(p.estado_pedido)} tono={tonoEstado(p.estado_pedido)} />}
          acciones={<Boton
            titulo={p.mensajes_sin_leer ? `Gestionar · ${p.mensajes_sin_leer} mensaje${p.mensajes_sin_leer === 1 ? '' : 's'} nuevo${p.mensajes_sin_leer === 1 ? '' : 's'}` : 'Gestionar pedido'}
            icono="pen-to-square"
            pequeno
            variante={p.mensajes_sin_leer ? 'primary' : 'soft'}
            onPress={() => void abrirDetalle(p.id)}
          />}
        >
          <Dato etiqueta="Comprador" valor={`${nombreComprador(p)}${p.comprador ? ` · ${p.comprador.email}` : ''}`} />
          <Dato etiqueta="Total" valor={pesos(p.monto)} />
          <Dato etiqueta="Envío a" valor={p.direccion_envio ? `${p.direccion_envio}, ${p.ciudad}` : 'Sin dirección registrada'} />
          <Dato etiqueta="Fecha" valor={fechaHora(p.created_at)} />
        </ItemLista>
      ))}

      <AppModal visible={!!detalle} onClose={() => setDetalle(null)} titulo={detalle ? `Pedido · ${detalle.producto}` : ''} anchoMaximo={600}>
        {detalle && (
          <>
            <Dato etiqueta="Transacción" valor={detalle.transaccion_id} />
            <Dato etiqueta="Cantidad" valor={detalle.cantidad} />
            <Dato etiqueta="Total pagado" valor={`${pesos(detalle.monto)} · ${detalle.metodo}`} />
            <Dato etiqueta="Fecha de compra" valor={fechaHora(detalle.created_at)} />
            <View style={{ maxWidth: 280, marginTop: 6 }}>
              <CampoSelect
                etiqueta="Estado del pedido"
                valor={detalle.estado_pedido}
                onChange={(v) => void cambiarEstado(v as EstadoPedido)}
                deshabilitado={pedidoCerrado(detalle.estado_pedido)}
                opciones={ESTADOS_PEDIDO}
              />
            </View>

            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 10 }}>Comprador y envío</Text>
            <Dato etiqueta="Cuenta" valor={`${nombreComprador(detalle)}${detalle.comprador ? ` · ${detalle.comprador.email}` : ''}`} />
            {detalle.direccion_envio ? (
              <>
                <Dato etiqueta="Recibe" valor={detalle.contacto_nombre} />
                <Dato etiqueta="Teléfono" valor={detalle.contacto_telefono} />
                <Dato etiqueta="Dirección" valor={`${detalle.direccion_envio}, ${detalle.ciudad}`} />
                {detalle.notas_cliente ? <Dato etiqueta="Indicaciones" valor={detalle.notas_cliente} /> : null}
              </>
            ) : <Alerta tipo="info" texto="Este pedido es anterior a los datos de envío. Pide la dirección al comprador por mensaje." />}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {detalle.contacto_telefono ? (
                <>
                  <Boton titulo="Llamar" icono="phone" pequeno variante="outline" onPress={() => abrir(`tel:${detalle.contacto_telefono}`)} />
                  <Boton titulo="WhatsApp" icono="comment-dots" pequeno variante="outline" onPress={() => abrir(`https://wa.me/${numeroWhatsApp(detalle.contacto_telefono ?? '')}?text=${encodeURIComponent(`Hola ${detalle.contacto_nombre}, te escribimos de EV Charge sobre tu pedido de ${detalle.producto}.`)}`)} />
                </>
              ) : null}
              {detalle.comprador?.email ? (
                <Boton titulo="Correo" icono="envelope" pequeno variante="outline" onPress={() => abrir(`mailto:${detalle.comprador?.email}?subject=${encodeURIComponent(`Tu pedido de ${detalle.producto} (${detalle.transaccion_id})`)}`)} />
              ) : null}
            </View>

            <View style={{ height: 10 }} />
            <ConversacionPedido
              vistaAdmin
              mensajes={detalle.mensajes}
              onEnviar={async (texto) => {
                const mensaje = await enviarMensajeCompraAdmin(detalle.id, texto);
                setDetalle((d) => (d ? { ...d, mensajes: [...d.mensajes, mensaje] } : d));
              }}
            />
          </>
        )}
      </AppModal>
    </>
  );
}
