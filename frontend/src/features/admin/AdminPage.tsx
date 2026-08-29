import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/admin.css';
import '../../styles/dashboard_usuario.css';
import { useAuth } from '../../context/AuthContext';
import {
  cambiarEstadoEstacion,
  eliminarEstacionAdmin,
  eliminarReservaAdmin,
  listarCalificacionesAdmin,
  listarEstacionesAdmin,
  listarReportesAdmin,
  listarReservasAdmin,
  listarUsuarios,
  obtenerEstadisticas,
  resolverReporte,
  type AdminEstadisticas,
  type CalificacionAdmin,
  type ReporteAdmin,
} from '../../api/admin.api';

type Row = Record<string, unknown>;
const paneles = ['Resumen', 'Usuarios', 'Reportes', 'Estaciones', 'Reservas', 'Calificaciones'];
const text = (row: Row, ...keys: string[]) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null)?.toString() || '—';
const idOf = (row: Row) => text(row, 'id', '_id');
const fecha = (value: string) => value && new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export function AdminPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState('Resumen');
  const [stats, setStats] = useState<AdminEstadisticas | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      if (panel === 'Resumen') {
        setStats(await obtenerEstadisticas());
        setRows([]);
      } else {
        const data = panel === 'Usuarios' ? await listarUsuarios() : panel === 'Reportes' ? await listarReportesAdmin() : panel === 'Estaciones' ? await listarEstacionesAdmin() : panel === 'Reservas' ? await listarReservasAdmin() : await listarCalificacionesAdmin();
        setRows(data as Row[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la información');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void cargar(); }, [panel]);

  const action = async (callback: () => Promise<unknown>) => {
    if (!window.confirm('¿Confirmas esta acción?')) return;
    try {
      await callback();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación');
    }
  };

  const renderRow = (row: Row) => {
    const id = idOf(row);
    if (panel === 'Reportes') {
      const reporte = row as unknown as ReporteAdmin;
      return <tr key={id}>
        <td><strong>{reporte.estacion_nombre || reporte.estacion_ocm_id}</strong><br /><small>{reporte.tipo}</small></td>
        <td><div className="admin-detail">{reporte.descripcion || 'Sin descripción'}</div><small>{fecha(reporte.fecha)}</small></td>
        <td><span className={`status-badge ${reporte.estado === 'resuelto' ? 'status-active' : 'status-pending'}`}>{reporte.estado}</span></td>
        <td>{reporte.estado !== 'resuelto' && <button className="btn-tbl" onClick={() => void action(() => resolverReporte(id))}>Resolver</button>}</td>
      </tr>;
    }
    if (panel === 'Calificaciones') {
      const calificacion = row as unknown as CalificacionAdmin;
      const puntaje = Math.max(0, Math.min(5, calificacion.puntaje));
      return <tr key={id}>
        <td><strong>{calificacion.estacion_nombre || calificacion.estacion_ocm_id}</strong><br /><small>Usuario: {calificacion.usuario_id}</small></td>
        <td><span className="rating-stars" aria-label={`${calificacion.puntaje} de 5 estrellas`}>{'★'.repeat(puntaje)}<span>{'★'.repeat(5 - puntaje)}</span></span><strong className="rating-score"> {calificacion.puntaje}/5</strong></td>
        <td><div className="admin-detail">{calificacion.comentario || 'Sin comentario'}</div></td>
        <td><small>{fecha(calificacion.fecha)}</small></td>
      </tr>;
    }
    const estado = text(row, 'estado', 'activa', 'is_admin');
    return <tr key={id}>
      <td><strong>{text(row, 'nombre', 'estacion_nombre', 'email', 'tipo', 'marca')}</strong><br /><small>{text(row, 'apellido', 'descripcion', 'estacion_ocm_id', 'modelo')}</small></td>
      <td>{estado}</td>
      <td>{panel === 'Estaciones' && id && <><button className="btn-tbl" onClick={() => void action(() => cambiarEstadoEstacion(id, estado !== 'true' && estado !== 'activa'))}>{estado === 'true' || estado === 'activa' ? 'Desactivar' : 'Activar'}</button> <button className="btn-tbl danger" onClick={() => void action(() => eliminarEstacionAdmin(id))}>Eliminar</button></>}{panel === 'Reservas' && id && <button className="btn-tbl danger" onClick={() => void action(() => eliminarReservaAdmin(id))}>Eliminar</button>}</td>
    </tr>;
  };

  const cerrarSesion = () => { logout(); navigate('/'); };
  const cards = stats ? [['Usuarios', stats.total_usuarios], ['Vehículos', stats.total_vehiculos], ['Reservas activas', stats.total_reservas_activas], ['Cargas', stats.total_cargas], ['Reportes abiertos', stats.total_reportes_abiertos], ['Estaciones propias', stats.total_estaciones_propias]] : [];
  const headings = panel === 'Reportes' ? ['Estación', 'Detalle', 'Estado', 'Acciones'] : panel === 'Calificaciones' ? ['Estación', 'Puntaje', 'Comentario', 'Fecha'] : ['Registro', 'Estado / detalle', 'Acciones'];

  return <div className="dashboard-shell">
    <aside id="admin-sidebar"><div className="admin-brand"><img src="/img/logo.png" alt="EV Charge" /><span>EV Charge</span></div><div className="admin-user-info-sidebar"><strong>{usuario?.nombre} {usuario?.apellido}</strong><small>Administrador</small></div><nav className="admin-nav">{paneles.map((item) => <button className={`anav${item === panel ? ' active' : ''}`} key={item} onClick={() => setPanel(item)}>{item}</button>)}</nav><div className="admin-nav-bottom"><Link className="anav" to="/mapa">Abrir mapa</Link><button className="anav danger" onClick={cerrarSesion}>Cerrar sesión</button></div></aside>
    <main id="admin-content"><header id="admin-header"><div><h1>{panel}</h1><p>Panel de administración EV Charge</p></div><Link className="btn-form" to="/mapa">Mapa</Link></header>
      <section className="panel active">{error && <div className="alert alert-error">{error}</div>}{cargando ? <p className="empty">Cargando información...</p> : panel === 'Resumen' ? <div className="kpi-grid">{cards.map(([label, value]) => <div className="kpi-card" key={label}><div className="kpi-label">{label}</div><div className="kpi-num">{value}</div></div>)}</div> : <div className="table-wrap"><table><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map(renderRow)}{!rows.length && <tr><td className="empty" colSpan={headings.length}>No hay registros.</td></tr>}</tbody></table></div>}</section>
    </main>
  </div>;
}
