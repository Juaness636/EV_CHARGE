// Conversación entre el comprador y el administrador sobre un pedido de productos.
import { useState } from 'react';
import type { MensajeCompra } from '../../api/compras.api';
import './pedidos.css';

interface Props {
  mensajes: MensajeCompra[];
  // true en el panel del admin: sus mensajes se alinean a la derecha.
  vistaAdmin?: boolean;
  cerrado?: boolean;
  onEnviar: (texto: string) => Promise<void>;
}

const errorDe = (e: unknown) => (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  || (e instanceof Error ? e.message : 'No se pudo enviar el mensaje.');

export function ConversacionPedido({ mensajes, vistaAdmin = false, cerrado = false, onEnviar }: Props) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const enviar = async () => {
    const limpio = texto.trim();
    if (!limpio) return;
    setError('');
    setEnviando(true);
    try {
      await onEnviar(limpio);
      setTexto('');
    } catch (e) {
      setError(errorDe(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pedido-chat">
      <strong>{vistaAdmin ? 'Conversación con el comprador' : 'Mensajes con EV Charge'}</strong>
      {mensajes.length === 0 && <p className="empty">{vistaAdmin ? 'Aún no hay mensajes. Escribe al comprador para confirmar la dirección o coordinar la entrega.' : 'Aún no hay mensajes. Si tienes dudas sobre el envío, escríbenos aquí.'}</p>}
      {mensajes.map((m) => (
        <div key={m.id} className={`pedido-burbuja${m.es_admin === vistaAdmin ? ' propio' : ''}`}>
          <small>{m.es_admin ? 'EV Charge' : 'Comprador'}</small>
          <p>{m.texto}</p>
          <small>{new Date(m.created_at).toLocaleString('es-CO')}</small>
        </div>
      ))}
      {error && <div className="alert alert-error">{error}</div>}
      {cerrado && !vistaAdmin
        ? <p className="empty">Este pedido ya está cerrado. Si necesitas ayuda, escríbenos desde Contacto.</p>
        : <>
          <textarea value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un mensaje" aria-label="Mensaje" />
          <div><button type="button" className="btn-tbl" disabled={!texto.trim() || enviando} onClick={() => void enviar()}>{enviando ? 'Enviando...' : 'Enviar mensaje'}</button></div>
        </>}
    </div>
  );
}
