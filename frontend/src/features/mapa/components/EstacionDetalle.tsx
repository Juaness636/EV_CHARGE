// Panel lateral de detalle de una estación: estado, favoritos, reserva rápida,
// calificar y reportar. Corresponde a mostrarDetallesEstacion() + funciones
// de favoritos/calificación/reporte/reserva en mapa.html original.
import { useEffect, useState } from 'react';
import type { Usuario } from '../../../api/auth.api';
import { obtenerEstadoEstacion, type EstadoEstacion } from '../../../api/estado.api';
import { listarFavoritos, agregarFavorito, quitarFavorito } from '../../../api/favoritos.api';
import { calificar } from '../../../api/calificaciones.api';
import { crearReporte } from '../../../api/reportes.api';
import { crearReserva } from '../../../api/reservas.api';
import type { EstacionOCM } from '../types';

interface Props {
  estacion: EstacionOCM;
  usuario: Usuario | null;
  onLoginRequerido: () => void;
  onCalcularRuta: (lat: number, lon: number) => void;
  onClose: () => void;
}

const TIPOS_REPORTE = ['averia', 'fuera_servicio', 'ocupado', 'otro'];

function proximaHoraISO(): string {
  const ahora = new Date();
  ahora.setMinutes(0, 0, 0);
  ahora.setHours(ahora.getHours() + 1);
  return ahora.toISOString().slice(0, 16);
}

export function EstacionDetalle({ estacion, usuario, onLoginRequerido, onCalcularRuta, onClose }: Props) {
  const ocmId = String(estacion.ID);
  const nombre = estacion.AddressInfo?.Title || 'Estación';
  const direccion = estacion.AddressInfo?.AddressLine1 || '—';
  const operador = estacion.OperatorInfo?.Title || 'Independiente';
  const lat = estacion.AddressInfo?.Latitude;
  const lon = estacion.AddressInfo?.Longitude;

  const [estado, setEstado] = useState<EstadoEstacion | null>(null);
  const [esFavorito, setEsFavorito] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Reserva rápida
  const [duracion, setDuracion] = useState(2);
  const [inicio, setInicio] = useState(proximaHoraISO());
  const [reservando, setReservando] = useState(false);

  // Calificación
  const [mostrarCalificar, setMostrarCalificar] = useState(false);
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');

  // Reporte
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [tipoReporte, setTipoReporte] = useState('');
  const [descReporte, setDescReporte] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);

  const finCalculado = new Date(new Date(inicio).getTime() + duracion * 60 * 60 * 1000);
  const finInvalido = new Date(inicio) < new Date();

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setMostrarCalificar(false);
    setMostrarReporte(false);
    setPuntaje(0);
    setComentario('');
    setTipoReporte('');
    setDescReporte('');
    setInicio(proximaHoraISO());
    setDuracion(2);

    obtenerEstadoEstacion(ocmId)
      .then((data) => !cancelado && setEstado(data))
      .catch(() => !cancelado && setEstado(null));

    if (usuario) {
      listarFavoritos()
        .then((favs) => !cancelado && setEsFavorito(favs.some((f) => f.estacion_ocm_id === ocmId)))
        .catch(() => {});
    }
    setCargando(false);

    return () => {
      cancelado = true;
    };
  }, [ocmId, usuario]);

  if (!usuario) {
    return (
      <>
        <p style={{ color: '#888', fontSize: 14 }}><i className="fa-solid fa-lock"></i> Inicia sesión para ver detalles.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn-outline-sm" onClick={onLoginRequerido}>Iniciar sesión</button>
        </div>
      </>
    );
  }

  const toggleFavorito = async () => {
    try {
      if (esFavorito) {
        await quitarFavorito(ocmId);
        setEsFavorito(false);
      } else {
        await agregarFavorito({ estacion_ocm_id: ocmId, estacion_nombre: nombre });
        setEsFavorito(true);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al actualizar favorito');
    }
  };

  const enviarCalificacion = async () => {
    if (!puntaje) return alert('Selecciona una calificación de 1 a 5');
    try {
      await calificar({ estacion_ocm_id: ocmId, estacion_nombre: nombre, puntaje, comentario });
      alert('¡Calificación enviada!');
      setMostrarCalificar(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al enviar calificación');
    }
  };

  const enviarReporte = async () => {
    if (!tipoReporte) return alert('Selecciona el tipo de problema');
    setEnviandoReporte(true);
    try {
      await crearReporte({ estacion_ocm_id: ocmId, estacion_nombre: nombre, tipo: tipoReporte, descripcion: descReporte });
      alert('¡Reporte enviado!');
      setMostrarReporte(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al enviar reporte');
    } finally {
      setEnviandoReporte(false);
    }
  };

  const confirmarReserva = async () => {
    const fechaInicio = new Date(inicio);
    if (fechaInicio >= finCalculado) return alert('La fecha de inicio debe ser anterior a la de fin.');
    if (fechaInicio < new Date()) return alert('No se puede reservar en el pasado. Elige una fecha futura.');
    setReservando(true);
    try {
      await crearReserva({
        estacion_ocm_id: ocmId,
        estacion_nombre: nombre,
        fecha_hora_inicio: fechaInicio.toISOString(),
        fecha_hora_fin: finCalculado.toISOString(),
      });
      alert('¡Reserva confirmada con éxito!');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al reservar');
    } finally {
      setReservando(false);
    }
  };

  return (
    <>
      <h3>{nombre}</h3>
      {cargando ? (
        <div className="badge badge-gray">Consultando...</div>
      ) : estado?.estado === 'disponible' ? (
        <div className="badge badge-green"><i className="fa-solid fa-circle-check"></i> Disponible</div>
      ) : estado?.estado === 'reservada' ? (
        <div className="badge badge-blue"><i className="fa-solid fa-clock"></i> Reservada por {String(estado.reservado_por || 'otro usuario')}</div>
      ) : estado?.estado === 'mantenimiento' ? (
        <div className="badge badge-red"><i className="fa-solid fa-screwdriver-wrench"></i> En mantenimiento</div>
      ) : null}

      <div style={{ margin: '8px 0', fontSize: 13, color: '#aaa' }}><i className="fa-solid fa-location-dot"></i> {direccion}</div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Operador: {operador}</div>

      <div style={{ fontWeight: 600, fontSize: 12, color: '#999', margin: '8px 0 4px' }}>Conectores</div>
      {(estacion.Connections || []).map((c, i) => (
        <div className="connector-card" key={i}>
          <strong><i className="fa-solid fa-plug"></i> {c.ConnectionType?.Title || 'Genérico'}</strong>{' '}
          <small>{c.PowerKW ? `${c.PowerKW} kW` : 'Potencia no especificada'} · {c.CurrentType?.Title || 'AC/DC'}</small>{' '}
          <small>Bahías: {c.Quantity || 1}</small>
        </div>
      ))}

      {estado?.estado === 'disponible' && !usuario.is_admin && (
        <div className="reserva-box" style={{ display: 'block' }}>
          <div className="duracion-control">
            <label style={{ fontSize: 12, color: '#aaa', marginRight: 8 }}>Duración:</label>
            <input type="range" min={1} max={8} step={1} value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} />
            <span>{duracion} h</span>
          </div>
          <div className="form-group" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#aaa', margin: 0 }}>Inicio:</label>
            <input type="datetime-local" style={{ flex: 1 }} value={inicio} onChange={(e) => setInicio(e.target.value)} />
            <button className="btn-now" onClick={() => setInicio(proximaHoraISO())}>Ahora</button>
          </div>
          <div className="form-group">
            <label style={{ fontSize: 12, color: '#aaa' }}>Fin:</label>
            <input
              type="datetime-local"
              readOnly
              value={finCalculado.toISOString().slice(0, 16)}
              style={{ background: '#2a2a2a', opacity: 0.7, border: finInvalido ? '1px solid #e74c3c' : '1px solid #555' }}
            />
          </div>
          <button className="btn btn-primary btn-block" disabled={reservando} onClick={confirmarReserva}>
            {reservando ? 'Procesando...' : 'Confirmar Reserva'}
          </button>
        </div>
      )}

      {!usuario.is_admin && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
          <button className={`btn-outline-sm${esFavorito ? ' btn-primary' : ''}`} onClick={toggleFavorito}>
            <i className={`fa-${esFavorito ? 'solid' : 'regular'} fa-star`}></i> Favorito
          </button>
          {lat != null && lon != null && (
            <button className="btn-ruta" onClick={() => onCalcularRuta(lat, lon)}><i className="fa-solid fa-route"></i> Ruta</button>
          )}
          <button className="btn-outline-sm" onClick={() => setMostrarCalificar((v) => !v)}><i className="fa-solid fa-star"></i> Calificar</button>
          <button className="btn-outline-sm" onClick={() => setMostrarReporte((v) => !v)}><i className="fa-solid fa-bullhorn"></i> Reportar</button>
        </div>
      )}

      {mostrarCalificar && (
        <div style={{ marginTop: 8, background: '#1e1e1e', padding: 12, borderRadius: 6 }}>
          <p style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}>Tu calificación:</p>
          <div className="stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`star${i <= puntaje ? ' filled' : ''}`} onClick={() => setPuntaje(i)}>
                <i className="fa-solid fa-star"></i>
              </span>
            ))}
          </div>
          <textarea
            rows={2}
            style={{ width: '100%', marginTop: 8, padding: 6, background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#fff', fontSize: 12, resize: 'vertical' }}
            placeholder="Comentario (opcional)"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
          <button className="btn-outline-sm" style={{ marginTop: 6, background: '#39a900', color: '#fff', border: 'none', padding: '6px 12px' }} onClick={enviarCalificacion}>
            Enviar
          </button>
        </div>
      )}

      {mostrarReporte && (
        <div style={{ marginTop: 8, background: '#1e1e1e', padding: 12, borderRadius: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {TIPOS_REPORTE.map((t) => (
              <button
                key={t}
                onClick={() => setTipoReporte(t)}
                style={{
                  background: tipoReporte === t ? '#39a900' : 'transparent',
                  border: `1px solid ${tipoReporte === t ? '#39a900' : '#555'}`,
                  color: tipoReporte === t ? '#fff' : '#aaa',
                  padding: '4px 12px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            style={{ width: '100%', padding: 6, background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, color: '#fff', fontSize: 12, resize: 'vertical' }}
            placeholder="Descripción"
            value={descReporte}
            onChange={(e) => setDescReporte(e.target.value)}
          />
          <button
            className="btn-outline-sm"
            style={{ marginTop: 6, background: '#39a900', color: '#fff', border: 'none', padding: '6px 12px' }}
            disabled={enviandoReporte}
            onClick={enviarReporte}
          >
            {enviandoReporte ? 'Enviando...' : 'Enviar reporte'}
          </button>
        </div>
      )}

      <p style={{ fontSize: 10, color: '#444', textAlign: 'center', marginTop: 12 }}>OCM ID: {ocmId}</p>
    </>
  );
}
