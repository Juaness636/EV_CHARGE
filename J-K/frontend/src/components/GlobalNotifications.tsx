import { useEffect, useRef, useState } from 'react';
import { listarNotificaciones, type Notificacion } from '../api/notificaciones.api';
import { useAuth } from '../context/AuthContext';

export type TipoNotificacion = 'success' | 'error' | 'warning' | 'info';
export interface NotificacionVisual {
  titulo: string;
  mensaje: string;
  tipo?: TipoNotificacion;
  duracionMs?: number;
}

export interface ConfirmacionVisual {
  titulo: string;
  mensaje: string;
  confirmarTexto?: string;
  cancelarTexto?: string;
  tipo?: Extract<TipoNotificacion, 'warning' | 'error'>;
}

export function notificar(notificacion: NotificacionVisual) {
  window.dispatchEvent(new CustomEvent<NotificacionVisual>('ev-charge:notificacion', { detail: notificacion }));
  window.dispatchEvent(new CustomEvent('ev-charge:notificaciones-actualizadas'));
}

export function confirmar(confirmacion: ConfirmacionVisual): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmacionVisual>('ev-charge:confirmacion', { detail: confirmacion }));
    window.dispatchEvent(new CustomEvent('ev-charge:confirmacion-resolver', { detail: resolve }));
  });
}

const iconoTipo = (tipo?: Notificacion['tipo'] | TipoNotificacion) => {
  if (tipo === 'reserva') return 'fa-calendar-check';
  if (tipo === 'pago' || tipo === 'compra') return 'fa-credit-card';
  if (tipo === 'reporte') return 'fa-triangle-exclamation';
  if (tipo === 'favorito') return 'fa-star';
  if (tipo === 'calificacion') return 'fa-star-half-stroke';
  if (tipo === 'vehiculo') return 'fa-car';
  if (tipo === 'error') return 'fa-circle-xmark';
  if (tipo === 'warning') return 'fa-triangle-exclamation';
  if (tipo === 'success') return 'fa-circle-check';
  return 'fa-bell';
};

export function GlobalNotifications() {
  const { usuario } = useAuth();
  const idsConocidos = useRef<Set<string>>(new Set());
  const primeraConsulta = useRef(true);
  const [notificacion, setNotificacion] = useState<Notificacion | null>(null);
  const [colaNotificaciones, setColaNotificaciones] = useState<Notificacion[]>([]);
  const [notificacionVisual, setNotificacionVisual] = useState<NotificacionVisual | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionVisual | null>(null);
  const resolverConfirmacion = useRef<((resultado: boolean) => void) | null>(null);

  useEffect(() => {
    idsConocidos.current = new Set();
    primeraConsulta.current = true;
    setNotificacion(null);
    setColaNotificaciones([]);
    setNotificacionVisual(null);
    const recibirNotificacion = (evento: Event) => {
      const detalle = (evento as CustomEvent<NotificacionVisual>).detail;
      setNotificacion(null);
      setNotificacionVisual(detalle);
    };
    const recibirConfirmacion = (evento: Event) => setConfirmacion((evento as CustomEvent<ConfirmacionVisual>).detail);
    const recibirResolver = (evento: Event) => { resolverConfirmacion.current = (evento as CustomEvent<(resultado: boolean) => void>).detail; };
    window.addEventListener('ev-charge:notificacion', recibirNotificacion);
    window.addEventListener('ev-charge:confirmacion', recibirConfirmacion);
    window.addEventListener('ev-charge:confirmacion-resolver', recibirResolver);
    if (!usuario) return () => {
      window.removeEventListener('ev-charge:notificacion', recibirNotificacion);
      window.removeEventListener('ev-charge:confirmacion', recibirConfirmacion);
      window.removeEventListener('ev-charge:confirmacion-resolver', recibirResolver);
    };
    let cancelado = false;
    const consultar = async () => {
      try {
        const lista = await listarNotificaciones();
        if (cancelado) return;
        if (primeraConsulta.current) {
          lista.forEach((item) => idsConocidos.current.add(item.id));
          primeraConsulta.current = false;
          return;
        }
        const nuevas = lista.filter((item) => !idsConocidos.current.has(item.id));
        lista.forEach((item) => idsConocidos.current.add(item.id));
        if (nuevas.length) {
          setNotificacion((actual) => actual || nuevas[0]);
          setColaNotificaciones((actuales) => actuales.length ? [...actuales, ...nuevas] : nuevas.slice(1));
        }
      } catch {
        // No interrumpir la navegación si el historial no está disponible.
      }
    };
    const actualizarAhora = () => { void consultar(); };
    window.addEventListener('ev-charge:notificaciones-actualizadas', actualizarAhora);
    void consultar();
    const intervalo = window.setInterval(() => void consultar(), 30000);
    return () => { cancelado = true; window.clearInterval(intervalo); window.removeEventListener('ev-charge:notificacion', recibirNotificacion); window.removeEventListener('ev-charge:confirmacion', recibirConfirmacion); window.removeEventListener('ev-charge:confirmacion-resolver', recibirResolver); window.removeEventListener('ev-charge:notificaciones-actualizadas', actualizarAhora); };
  }, [usuario]);

  useEffect(() => {
    if (!notificacion && !notificacionVisual) return;
    const temporizador = window.setTimeout(() => {
      setNotificacionVisual(null);
      setNotificacion((actual) => {
        if (!actual) return null;
        let siguiente: Notificacion | undefined;
        setColaNotificaciones((actuales) => {
          [siguiente, ...[]] = actuales;
          return actuales.slice(1);
        });
        return siguiente || null;
      });
    }, notificacionVisual?.duracionMs || 4000);
    return () => window.clearTimeout(temporizador);
  }, [notificacion, notificacionVisual]);

  const responderConfirmacion = (resultado: boolean) => {
    resolverConfirmacion.current?.(resultado);
    resolverConfirmacion.current = null;
    setConfirmacion(null);
  };
  if (!notificacion && !notificacionVisual && !confirmacion) return null;
  const titulo = notificacionVisual?.titulo || notificacion?.titulo || '';
  const mensaje = notificacionVisual?.mensaje || notificacion?.mensaje || '';
  const tipo = notificacionVisual?.tipo;
  const icono = iconoTipo(notificacion?.tipo || tipo);
  const color = tipo === 'error' ? '#e74c3c' : tipo === 'warning' ? '#f39c12' : tipo === 'success' ? '#39a900' : notificacion?.tipo === 'reporte' ? '#f39c12' : notificacion?.tipo === 'pago' ? '#39a900' : '#3498db';
  return (<>
    {confirmacion && <div role="dialog" aria-modal="true" aria-labelledby="confirmacion-titulo" style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0, 0, 0, .62)' }}>
      <div style={{ width: 'min(420px, 100%)', padding: 20, borderRadius: 12, border: '1px solid #f39c12', background: '#171717', color: '#fff', boxShadow: '0 14px 40px rgba(0,0,0,.55)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span style={{ width: 32, height: 32, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f39c1222', color: '#f39c12', flexShrink: 0 }}><i className="fa-solid fa-triangle-exclamation"></i></span><div><strong id="confirmacion-titulo" style={{ display: 'block', color: '#f39c12' }}>{confirmacion.titulo}</strong><p style={{ margin: '6px 0 0', color: '#ddd', fontSize: 13, lineHeight: 1.45 }}>{confirmacion.mensaje}</p></div></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}><button type="button" className="btn-tbl" onClick={() => responderConfirmacion(false)}>{confirmacion.cancelarTexto || 'Cancelar'}</button><button type="button" className="btn-tbl danger" onClick={() => responderConfirmacion(true)}>{confirmacion.confirmarTexto || 'Confirmar'}</button></div>
      </div>
    </div>}
    {(notificacion || notificacionVisual) &&
    <div role="status" aria-live="polite" style={{ position: 'fixed', top: 20, right: 20, zIndex: 10000, width: 'min(360px, calc(100vw - 32px))', padding: '14px 42px 14px 16px', borderRadius: 10, border: `1px solid ${color}`, background: 'rgba(20, 20, 20, 0.96)', color: '#fff', boxShadow: '0 8px 28px rgba(0,0,0,.45)' }}>
      <button type="button" aria-label="Cerrar notificación" onClick={() => { setNotificacion(null); setNotificacionVisual(null); }} style={{ position: 'absolute', top: 8, right: 10, border: 0, background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 18 }}>×</button>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, color, flexShrink: 0 }}><i className={`fa-solid ${icono}`}></i></span>
        <span><strong style={{ display: 'block', color }}>{titulo}</strong><span style={{ display: 'block', marginTop: 5, fontSize: 13, lineHeight: 1.4 }}>{mensaje}</span></span>
      </div>
    </div>
    }
  </>);
}
