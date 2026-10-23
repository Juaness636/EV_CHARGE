import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/admin.css';
import { useAuth } from '../../context/AuthContext';
import { obtenerPerfil, actualizarPerfil, cambiarPassword } from '../../api/auth.api';
import { notificar } from '../../components/GlobalNotifications';
import {
  obtenerEstadisticas, listarUsuarios, listarReportesAdmin, listarEstacionesOcmAdmin,
  listarReservasAdmin, listarCalificacionesAdmin, listarContactosAdmin, cambiarEstadoReporte,
  actualizarReservaAdmin, eliminarReservaAdmin, responderContactoAdmin,
  crearEstacion, actualizarEstacion, cambiarEstadoEstacion, eliminarEstacionAdmin,
  cambiarEstadoEstacionOcm, actualizarEstacionOcm, eliminarEstacionOcmAdmin,
  actualizarUsuarioAdmin, listarNotificacionesAdmin,
  type EstacionCargadorData,
  type AdminEstadisticas, type AdminReservaDetail, type ReporteAdmin, type CalificacionAdmin, type ContactoAdmin,
  type UserAdmin, type AdminNotificacion,
  listarEmpresasAdmin, crearEmpresaAdmin, cambiarEstadoEmpresaAdmin, cambiarPalabrasEmpresaAdmin, type EmpresaCrear, type MarcaEmpresa,
} from '../../api/admin.api';
import { LONGITUD_MINIMA_MOTIVO, type EmpresaPerfil, type EstadoEmpresa } from '../../api/empresa.api';

type ThemeMode = 'dark' | 'light' | 'system';

type Panel = 'Resumen' | 'Usuarios' | 'Reportes' | 'Estaciones' | 'Empresas' | 'Reservas' | 'Notificaciones' | 'Calificaciones' | 'Contactos' | 'Perfil';
type Row = Record<string, unknown>;
const TIPOS_CARGADOR = ['CCS', 'Type 2', 'CHAdeMO', 'GB/T', 'J1772'] as const;
const panels: Panel[] = ['Resumen', 'Usuarios', 'Reportes', 'Estaciones', 'Empresas', 'Reservas', 'Notificaciones', 'Calificaciones', 'Contactos', 'Perfil'];
const date = (value?: string) => value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';
const getStatusClass = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (value.includes('inactiva') || value.includes('cerrado') || value.includes('fuera')) return 'status-inactive';
  if (value.includes('activa') || value.includes('resuelto')) return 'status-active';
  if (value.includes('mantenimiento') || value.includes('pendiente')) return 'status-pending';
  return 'status-default';
};
const getReportStatusLabel = (status: string) => ({
  todos: 'Todos',
  abierto: 'Abiertos',
  mantenimiento: 'Mantenimiento',
  resuelto: 'Resueltos',
  fuera_servicio: 'Fuera de servicio',
}[status] || status);

export function AdminPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>('Resumen');
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<AdminEstadisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const cargaActivaRef = useRef<Panel | null>(null);
  
  // Estado para el tema
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => (localStorage.getItem('ev_theme') as ThemeMode) || 'system'
  );

  // Efecto para aplicar el tema
  useEffect(() => {
    const root = document.documentElement;

    const aplicarTema = (mode: ThemeMode) => {
      let temaEfectivo = mode;
      if (mode === 'system') {
        temaEfectivo = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.setAttribute('data-theme', temaEfectivo);
      localStorage.setItem('ev_theme', mode);
    };

    aplicarTema(themeMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (themeMode === 'system') aplicarTema('system');
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themeMode]);

  const load = async () => {
    if (cargaActivaRef.current === panel) return;
    cargaActivaRef.current = panel;
    setLoading(true);
    setError('');
    try {
      if (panel === 'Resumen') {
        setStats(await obtenerEstadisticas());
        setRows([]);
        return;
      }

      const data = panel === 'Usuarios'
        ? await listarUsuarios()
        : panel === 'Reportes'
          ? await listarReportesAdmin()
          : panel === 'Estaciones'
            ? await listarEstacionesOcmAdmin()
            : panel === 'Empresas'
              ? await listarEmpresasAdmin()
            : panel === 'Reservas'
              ? await listarReservasAdmin()
              : panel === 'Notificaciones'
                ? await listarNotificacionesAdmin()
                : panel === 'Calificaciones'
                ? await listarCalificacionesAdmin()
                : panel === 'Perfil'
                  ? []
                  : await listarContactosAdmin();
      setRows(data as unknown as Row[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la informacion.');
    } finally {
      setLoading(false);
      if (cargaActivaRef.current === panel) cargaActivaRef.current = null;
    }
  };

  useEffect(() => { void load(); }, [panel]);

  const run = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await load();
      notificar({ tipo: 'success', titulo: 'Operación completada', mensaje: 'Los cambios se guardaron correctamente.' });
      window.localStorage.setItem('ev-charge:estaciones-actualizadas', String(Date.now()));
      window.dispatchEvent(new Event('ev-charge:estaciones-actualizadas'));
    } catch (cause) {
      const mensaje = cause instanceof Error ? cause.message : 'No se pudo completar la operacion.';
      setError(mensaje);
      notificar({ tipo: 'error', titulo: 'Operación no completada', mensaje });
    }
  };

  return (
    <div className="dashboard-shell">
      <aside id="admin-sidebar">
        <Link className="admin-brand" to="/" aria-label="Ir al inicio de EV Charge"><img src="/img/logo.png" alt="EV Charge" /><span>EV Charge</span></Link>
        <div className="admin-user-info-sidebar"><strong>{usuario?.nombre} {usuario?.apellido}</strong><small>Administrador</small></div>
        <nav className="admin-nav">{panels.map((item) => <button className={`anav${panel === item ? ' active' : ''}`} key={item} onClick={() => setPanel(item)}>{item}</button>)}</nav>
        <div className="admin-nav-bottom">
          <Link className="anav" to="/mapa">Abrir mapa</Link>
          <button className="anav danger" onClick={() => { logout(); navigate('/'); }}>Cerrar sesion</button>
        </div>
      </aside>

      <main id="admin-content">
        <header id="admin-header"><div><h1>{panel}</h1><p>Panel de administracion EV Charge</p></div></header>
        <section className="panel active">
          {error && <div className="alert alert-error">{error}</div>}
          {loading ? <p className="empty">Cargando...</p> : panel === 'Resumen' ? <Summary stats={stats} /> : panel === 'Usuarios' ? <Users rows={rows} /> : panel === 'Reportes' ? <Reports rows={rows as unknown as ReporteAdmin[]} run={run} /> : panel === 'Estaciones' ? <StationsAdmin rows={rows} run={run} /> : panel === 'Empresas' ? <EmpresasAdmin rows={rows as unknown as EmpresaPerfil[]} run={run} /> : panel === 'Reservas' ? <Reservations rows={rows as unknown as AdminReservaDetail[]} run={run} /> : panel === 'Notificaciones' ? <Notifications rows={rows as unknown as AdminNotificacion[]} /> : panel === 'Calificaciones' ? <Ratings rows={rows as unknown as CalificacionAdmin[]} /> : panel === 'Contactos' ? <Contacts rows={rows as unknown as ContactoAdmin[]} run={run} /> : <ProfilePanel usuario={usuario} />}
        </section>
      </main>
      <div className="theme-floating-widget">
        <button className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`} onClick={() => setThemeMode('dark')} title="Modo Oscuro">
          <i className="fa-solid fa-moon"></i>
        </button>
        <button className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`} onClick={() => setThemeMode('light')} title="Modo Claro">
          <i className="fa-solid fa-sun"></i>
        </button>
        <button className={`theme-btn ${themeMode === 'system' ? 'active' : ''}`} onClick={() => setThemeMode('system')} title="Tema del Sistema">
          <i className="fa-solid fa-circle-half-stroke"></i>
        </button>
      </div>
    </div>
  );
}

function Summary({ stats }: { stats: AdminEstadisticas | null }) {
  const cards = stats ? [['Usuarios', stats.total_usuarios], ['Vehiculos', stats.total_vehiculos], ['Reservas activas', stats.total_reservas_activas], ['Cargas', stats.total_cargas], ['Reportes abiertos', stats.total_reportes_abiertos], ['Estaciones propias', stats.total_estaciones_propias], ['Empresas', stats.total_empresas ?? 0], ['Empresas pendientes', stats.empresas_pendientes ?? 0]] : [];
  return <div className="kpi-grid">{cards.map(([name, count]) => <div className="kpi-card" key={String(name)}><div className="kpi-label">{name}</div><div className="kpi-num">{String(count)}</div></div>)}</div>;
}

function Users({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ is_admin: false });

  const filteredRows = rows.filter((row) => {
    const texto = `${row.nombre ?? ''} ${row.apellido ?? ''} ${row.email ?? ''}`.toLowerCase();
    return texto.includes(query.toLowerCase());
  });

  const handleSave = async () => {
    if (!editingId) return;
    await actualizarUsuarioAdmin(editingId, form);
    setEditingId(null);
    window.location.reload();
  };

  return <>
    <div className="panel-toolbar">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, apellido o correo" />
    </div>
    <Table headers={['Nombre y apellidos', 'Correo', 'Rol', 'Fecha de creacion', 'Acciones']}>
      {filteredRows.map((r) => <tr key={String(r.id)}>
        <td><strong>{String(r.nombre || '')} {String(r.apellido || '')}</strong></td>
        <td>{String(r.email || '')}</td>
        <td>{r.rol === 'empresa' ? 'Empresa' : r.is_admin ? 'Administrador' : 'Usuario'}</td><td>{date(String(r.created_at || ''))}</td>
        <td>
          <button className="btn-tbl" onClick={() => { setEditingId(String(r.id)); setForm({ is_admin: Boolean(r.is_admin) }); }}>Editar rol</button>
        </td>
      </tr>)}
    </Table>

    {editingId && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void handleSave(); }} style={{ marginTop: 20 }}>
      <div className="full-width"><label>Rol del usuario</label><select value={form.is_admin ? 'admin' : 'usuario'} onChange={(e) => setForm({ is_admin: e.target.value === 'admin' })}><option value="usuario">Usuario</option><option value="admin">Administrador</option></select></div>
      <div className="full-width">
        <button className="btn-save-estacion" type="submit">Guardar cambios</button>
        <button className="btn-tbl" type="button" onClick={() => setEditingId(null)} style={{ marginLeft: 10 }}>Cancelar</button>
      </div>
    </form>}
  </>;
}

function Reports({ rows, run }: { rows: ReporteAdmin[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const [filtro, setFiltro] = useState<'todos' | 'abierto' | 'mantenimiento' | 'resuelto' | 'fuera_servicio'>('todos');
  const filas = filtro === 'todos' ? rows : rows.filter((r) => r.estado === filtro);

  return <>
    <div className="panel-toolbar">
      <div className="filter-pills">
        {(['todos', 'abierto', 'mantenimiento', 'resuelto', 'fuera_servicio'] as const).map((estado) => (
          <button key={estado} className={`pill ${filtro === estado ? 'active' : ''}`} onClick={() => setFiltro(estado)}>{getReportStatusLabel(estado)}</button>
        ))}
      </div>
    </div>
    <Table headers={['Estacion y usuario', 'Comentario', 'Fecha', 'Acciones']}>
      {filas.map((r) => <tr key={r.id}><td><strong>{r.estacion_nombre || r.estacion_ocm_id}</strong><br /><small>Usuario: {r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido || ''}` : r.usuario_id}</small><br /><small>{r.usuario?.email}</small></td><td><strong>{r.tipo}</strong><br />{r.descripcion || 'Sin comentario'}</td><td>{date(r.fecha)}</td><td><span className={`status-badge ${getStatusClass(r.estado)}`}>{r.estado === 'fuera_servicio' ? 'Fuera de servicio' : r.estado}</span><br /><button className="btn-tbl" onClick={() => void run(() => cambiarEstadoReporte(r.id, 'mantenimiento'))}>Poner en mantenimiento</button> <button className="btn-tbl" onClick={() => void run(() => cambiarEstadoReporte(r.id, 'fuera_servicio'))}>Fuera de servicio</button> <button className="btn-tbl" onClick={() => void run(() => cambiarEstadoReporte(r.id, 'resuelto'))}>Resolver</button></td></tr>)}
    </Table>
  </>;
}

function Reservations({ rows, run }: { rows: AdminReservaDetail[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  return <>
    <Table headers={['Estacion', 'Usuario', 'Fechas', 'Acciones']}>
      {rows.map((r) => <tr key={r.id}><td>{r.estacion_nombre || r.estacion_ocm_id}</td><td><strong>{r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido || ''}` : r.usuario_id}</strong><br /><small>{r.usuario?.email}</small></td><td>{date(r.fecha_hora_inicio)}<br /><small>Hasta: {date(r.fecha_hora_fin)}</small></td><td><span className={`status-badge ${getStatusClass(r.estado)}`}>{r.estado === 'activa' ? 'Aceptada' : r.estado}</span><br />{r.estado === 'pendiente' && <small>Esperando pago del usuario</small>} {r.estado === 'activa' && <button className="btn-tbl" onClick={() => void run(() => actualizarReservaAdmin(r.id, { estado: 'realizada' }))}>Marcar realizada</button>} {r.estado === 'realizada' && <button className="btn-tbl danger" onClick={() => void run(() => eliminarReservaAdmin(r.id))}>Eliminar</button>}</td></tr>)}
    </Table>
  </>;
}

function Notifications({ rows }: { rows: AdminNotificacion[] }) {
  const [filtro, setFiltro] = useState<'todos' | 'dia' | 'mes' | 'anio'>('todos');
  const ahora = new Date();
  const filas = rows.filter((row) => {
    if (filtro === 'todos') return true;
    const fecha = new Date(row.created_at);
    if (filtro === 'dia') return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth() && fecha.getDate() === ahora.getDate();
    if (filtro === 'mes') return fecha.getFullYear() === ahora.getFullYear() && fecha.getMonth() === ahora.getMonth();
    return fecha.getFullYear() === ahora.getFullYear();
  });
  return <>
    <div className="panel-toolbar notification-filter-toolbar"><label htmlFor="filtro-notificaciones">Mostrar:</label><select id="filtro-notificaciones" value={filtro} onChange={(event) => setFiltro(event.target.value as typeof filtro)}><option value="todos">Todas</option><option value="dia">Hoy</option><option value="mes">Este mes</option><option value="anio">Este año</option></select><span>{filas.length} notificación{filas.length === 1 ? '' : 'es'}</span></div>
    <Table headers={['Usuario', 'Actividad', 'Tipo', 'Fecha']}>
    {filas.map((r) => <tr key={r.id}>
      <td><strong>{r.usuario_nombre || 'Usuario eliminado'}</strong><br /><small>{r.usuario_email || r.usuario_id}</small></td>
      <td><strong>{r.titulo}</strong><br /><small>{r.mensaje}</small></td>
      <td>{r.tipo}</td>
      <td>{date(r.created_at)}</td>
    </tr>)}
    {!filas.length && <tr><td className="empty" colSpan={4}>No hay notificaciones para este filtro.</td></tr>}
    </Table>
  </>;
}

function Ratings({ rows }: { rows: CalificacionAdmin[] }) {
  return <Table headers={['Estacion y usuario', 'Estrellas', 'Comentario', 'Fecha']}>{rows.map((r) => <tr key={r.id}><td><strong>{r.estacion_nombre || r.estacion_ocm_id}</strong><br /><small>{r.usuario_nombre || r.usuario_id}</small></td><td><span className="rating-stars">{'★'.repeat(r.puntaje)}<span>{'★'.repeat(5 - r.puntaje)}</span></span> {r.puntaje}/5</td><td>{r.comentario || 'Sin comentario'}</td><td>{date(r.fecha)}</td></tr>)}</Table>;
}

function Contacts({ rows, run }: { rows: ContactoAdmin[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  return <Table headers={['Usuario', 'Mensaje', 'Fecha', 'Respuesta']}>{rows.map((r) => {
    const respondido = Boolean(r.respuesta?.trim());
    return <tr key={r.id}><td><strong>{r.nombre} {r.apellido || ''}</strong><br /><small>{r.correo}</small></td><td>{r.mensaje}</td><td>{date(r.fecha_envio)}<br /><span className={`status-badge ${getStatusClass(r.estado)}`}>{r.estado}</span></td><td>{open === r.id && !respondido ? <><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe la respuesta" /><button className="btn-tbl" disabled={!reply.trim()} onClick={() => { void run(() => responderContactoAdmin(r.id, reply.trim())); setOpen(null); setReply(''); }}>Enviar</button></> : <><div>{r.respuesta || 'Sin respuesta'}</div>{respondido ? <span className="status-badge status-active">Respondido</span> : <button className="btn-tbl" onClick={() => { setOpen(r.id); setReply(''); }}>Responder</button>}</>}</td></tr>;
  })}</Table>;
}

function StationsAdmin({ rows, run }: { rows: Row[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    id: '', nombre: '', direccion: '', lat: '', lon: '', tipo_conector: 'CCS', potencia_kw: '', descripcion: '', operador: 'EV Charge', estado: 'activa',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOrigin, setEditingOrigin] = useState<string | null>(null);
  const [cargadores, setCargadores] = useState<EstacionCargadorData[]>([]);
  const stationFormRef = useRef<HTMLFormElement>(null);
  const [query, setQuery] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'activa' | 'mantenimiento' | 'inactiva'>('todos');

  const filteredRows = rows.filter((row) => {
    const matchesQuery = !query || `${row.id ?? ''} ${row.nombre ?? ''} ${row.operador ?? ''}`.toLowerCase().includes(query.toLowerCase());
    const matchesEstado = estadoFiltro === 'todos' || row.estado === estadoFiltro;
    return matchesQuery && matchesEstado;
  });

  const resetForm = () => {
    setForm({ id: '', nombre: '', direccion: '', lat: '', lon: '', tipo_conector: 'CCS', potencia_kw: '', descripcion: '', operador: 'EV Charge', estado: 'activa' });
    setEditingId(null);
    setEditingOrigin(null);
    setCargadores([]);
  };

  useEffect(() => {
    if (!editingId) return;
    requestAnimationFrame(() => {
      const formulario = stationFormRef.current;
      if (!formulario) return;
      const encabezado = document.getElementById('admin-header');
      const alturaEncabezado = encabezado?.getBoundingClientRect().height || 0;
      const posicion = formulario.getBoundingClientRect().top + window.scrollY - alturaEncabezado - 16;
      window.scrollTo({ top: Math.max(0, posicion), behavior: 'smooth' });
      formulario.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus({ preventScroll: true });
    });
  }, [editingId]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      id: form.id.trim() || undefined,
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim() || undefined,
      lat: Number(form.lat),
      lon: Number(form.lon),
      tipo_conector: form.tipo_conector.trim(),
      potencia_kw: Number(form.potencia_kw),
      descripcion: form.descripcion.trim() || '',
      operador: form.operador.trim() || 'EV Charge',
      estado: form.estado as 'activa' | 'mantenimiento' | 'inactiva',
      cargadores: editingOrigin === 'OpenChargeMap' ? undefined : cargadores.filter((cargador) => cargador.tipo_conector.trim() && Number.isFinite(cargador.potencia_kw)),
    };

    if (!payload.nombre || Number.isNaN(payload.lat) || Number.isNaN(payload.lon) || Number.isNaN(payload.potencia_kw)) {
      return;
    }

    if (editingId && editingOrigin === 'OpenChargeMap') {
      await run(() => actualizarEstacionOcm(editingId, {
        nombre: payload.nombre,
        direccion: payload.direccion,
        operador: payload.operador,
        lat: payload.lat,
        lon: payload.lon,
        estado: payload.estado,
      }));
    } else if (editingId) {
      await run(() => actualizarEstacion(editingId, payload));
    } else {
      await run(() => crearEstacion(payload));
    }
    window.localStorage.setItem('ev-charge:estaciones-actualizadas', String(Date.now()));
    window.dispatchEvent(new Event('ev-charge:estaciones-actualizadas'));
    resetForm();
  };

  return <>
    <form ref={stationFormRef} className="admin-form-grid station-form" onSubmit={handleSubmit}>
      <div><label>ID de estación</label><input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="Ej. EV-001" /></div>
      <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la estación" required /></div>
      <div><label>Proveedor</label><input value={form.operador} onChange={(e) => setForm({ ...form, operador: e.target.value })} placeholder="EV Charge" /></div>
      <div><label>Dirección</label><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Cra 123 #45-67" /></div>
      <div><label>Latitud</label><input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="4.711" /></div>
      <div><label>Longitud</label><input type="number" step="any" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} placeholder="-74.072" /></div>
      <div><label>Tipo de conector</label><input value={form.tipo_conector} onChange={(e) => setForm({ ...form, tipo_conector: e.target.value })} placeholder="CCS" /></div>
      <div><label>Potencia (kW)</label><input type="number" step="any" value={form.potencia_kw} onChange={(e) => setForm({ ...form, potencia_kw: e.target.value })} placeholder="22" /></div>
      {editingOrigin !== 'OpenChargeMap' && <div className="full-width charger-editor"><div className="charger-editor-header"><label>Cargadores de la estación</label><button type="button" className="btn-tbl" onClick={() => setCargadores(cargadores.length ? [...cargadores, { tipo_conector: 'CCS', potencia_kw: 22, corriente: 'AC', bahias: 1 }] : [{ tipo_conector: form.tipo_conector || 'CCS', potencia_kw: Number(form.potencia_kw) || 22, corriente: 'No especificada', bahias: 1 }, { tipo_conector: 'CCS', potencia_kw: 22, corriente: 'AC', bahias: 1 }])}>+ Agregar cargador</button></div>{cargadores.map((cargador, index) => <div className="charger-editor-row" key={`${cargador.id || 'nuevo'}-${index}`}><label>Tipo de conector<select aria-label={`Tipo de conector ${index + 1}`} value={cargador.tipo_conector} onChange={(e) => setCargadores(cargadores.map((item, itemIndex) => itemIndex === index ? { ...item, tipo_conector: e.target.value } : item))}>{TIPOS_CARGADOR.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></label><label>Potencia (kW)<input aria-label={`Potencia del cargador ${index + 1}`} type="number" min="0" step="any" value={cargador.potencia_kw} onChange={(e) => setCargadores(cargadores.map((item, itemIndex) => itemIndex === index ? { ...item, potencia_kw: Number(e.target.value) } : item))} placeholder="22" /></label><label>Bahías<input aria-label={`Bahías del cargador ${index + 1}`} type="number" min="1" step="1" value={cargador.bahias ?? 1} onChange={(e) => setCargadores(cargadores.map((item, itemIndex) => itemIndex === index ? { ...item, bahias: Number(e.target.value) } : item))} placeholder="1" /></label>{cargadores.length > 1 && <button type="button" className="btn-tbl danger" onClick={() => setCargadores(cargadores.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>}</div>)}{!cargadores.length && <small>Agrega los cargadores disponibles en esta estación.</small>}</div>}
      <div className="full-width"><label>Descripción</label><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} placeholder="Detalles relevantes de la estación" /></div>
      <div><label>Estado</label><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}><option value="activa">Activa</option><option value="mantenimiento">Mantenimiento</option><option value="inactiva">Fuera de servicio</option></select></div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion">{editingId ? 'Guardar cambios' : 'Crear estación'}</button>
        {editingId && <button type="button" className="btn-tbl" onClick={resetForm}>Cancelar</button>}
      </div>
    </form>

    <div className="panel-toolbar">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estación por ID, nombre o proveedor" />
      <div className="filter-pills">
        {(['todos', 'activa', 'mantenimiento', 'inactiva'] as const).map((estado) => (
          <button key={estado} className={`pill ${estadoFiltro === estado ? 'active' : ''}`} onClick={() => setEstadoFiltro(estado)}>{estado === 'todos' ? 'Todos' : estado === 'inactiva' ? 'Fuera de servicio' : estado}</button>
        ))}
      </div>
    </div>

    <Table headers={['Estacion', 'Proveedor', 'Estado', 'Acciones']}>
      {filteredRows.map((r) => { const esExterna = String(r.origen || '') === 'OpenChargeMap'; const id = String(r.id || ''); const estado = String(r.estado || 'activa') as 'activa' | 'mantenimiento' | 'inactiva'; const conectores = r.conectores as Array<{ id?: unknown; tipo?: unknown; potencia_kw?: unknown; corriente?: unknown; bahias?: unknown }> | undefined; const etiquetaEstado = estado === 'inactiva' ? 'Fuera de servicio' : estado; const marca = r.empresa as MarcaEmpresa | null | undefined; const nuevoEstado = estado === 'activa' ? 'inactiva' : 'activa'; const cambiarEstado = () => { if (esExterna) return run(() => cambiarEstadoEstacionOcm(id, nuevoEstado)); if (!marca) return run(() => cambiarEstadoEstacion(id, nuevoEstado)); /* Estación de empresa: el motivo queda en su historial (RN-E04). */ const motivo = window.prompt(`Motivo para cambiar ${String(r.nombre || '')} a ${nuevoEstado === 'activa' ? 'activa' : 'fuera de servicio'} (mínimo ${LONGITUD_MINIMA_MOTIVO} caracteres). La empresa recibirá este motivo.`); if (!motivo || motivo.trim().length < LONGITUD_MINIMA_MOTIVO) return Promise.resolve(); return run(() => cambiarEstadoEstacion(id, nuevoEstado, motivo.trim())); }; return <tr key={`${esExterna ? 'ocm' : 'propia'}-${id}`}><td>{String(r.nombre || '')}<br /><small>ID: {id}</small><br /><small>{esExterna ? 'OpenChargeMap' : marca ? <><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: marca.color_hex, marginRight: 5 }} />{marca.nombre} ({marca.estado})</> : 'EV Charge'}</small></td><td>{String(r.operador || '')}</td><td><span className={`status-badge ${getStatusClass(estado)}`}>{etiquetaEstado}</span></td><td>{!marca && <><button className="btn-tbl" onClick={() => { setEditingId(id); setEditingOrigin(esExterna ? 'OpenChargeMap' : 'EV Charge'); setCargadores(esExterna ? [] : (conectores || []).map((cargador) => ({ id: String(cargador.id || ''), tipo_conector: String(cargador.tipo || 'CCS'), potencia_kw: Number(cargador.potencia_kw || 0), corriente: String(cargador.corriente || 'No especificada'), bahias: Number(cargador.bahias || 1) }))); setForm({ id, nombre: String(r.nombre || ''), direccion: String(r.direccion || ''), lat: String(r.lat ?? ''), lon: String(r.lon ?? ''), tipo_conector: String(r.tipo_conector || conectores?.[0]?.tipo || 'CCS'), potencia_kw: String(r.potencia_kw ?? conectores?.[0]?.potencia_kw ?? ''), descripcion: String(r.descripcion || ''), operador: String(r.operador || 'EV Charge'), estado }); }}>Editar</button> </>}<button className="btn-tbl" onClick={() => void cambiarEstado()}>{estado === 'activa' ? 'Fuera de servicio' : 'Activar'}</button> <button className="btn-tbl danger" onClick={() => void run(() => esExterna ? eliminarEstacionOcmAdmin(id) : eliminarEstacionAdmin(id))}>Eliminar</button></td></tr>; })}
    </Table>
  </>;
}

function EmpresasAdmin({ rows, run }: { rows: EmpresaPerfil[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const vacio: EmpresaCrear = {
    nombre_comercial: '', razon_social: '', nit: '', telefono: '', email_contacto: '', direccion_sede: '',
    descripcion: '', color_hex: '#16a34a', palabras_clave: '', usuario_nombre: '', usuario_apellido: '', usuario_email: '', usuario_password: '',
  };
  const [form, setForm] = useState<EmpresaCrear>(vacio);
  const [modoCuenta, setModoCuenta] = useState<'nueva' | 'existente'>('nueva');
  const [query, setQuery] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | EstadoEmpresa>('todos');
  const [motivoOp, setMotivoOp] = useState<{ id: string; nombre: string; estado: EstadoEmpresa } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [palabrasOp, setPalabrasOp] = useState<{ id: string; nombre: string; valor: string } | null>(null);

  const filtradas = rows.filter((e) => {
    const texto = `${e.nombre_comercial} ${e.razon_social || ''} ${e.nit || ''} ${e.email_contacto || ''}`.toLowerCase();
    return (!query || texto.includes(query.toLowerCase())) && (estadoFiltro === 'todos' || e.estado === estadoFiltro);
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.nombre_comercial.trim().length < 2) return;
    const { usuario_nombre, usuario_apellido, usuario_email, usuario_password, usuario_existente_email, ...empresa } = form;
    if (modoCuenta === 'existente' ? !usuario_existente_email?.trim() : !usuario_email?.trim() || (usuario_password?.length ?? 0) < 8) return;
    // El backend exige una sola opción: cuenta nueva o usuario ya registrado.
    const cuenta = modoCuenta === 'existente'
      ? { usuario_existente_email: usuario_existente_email?.trim() }
      : { usuario_nombre, usuario_apellido, usuario_email: usuario_email?.trim(), usuario_password };
    await run(() => crearEmpresaAdmin({
      ...empresa,
      ...cuenta,
      nombre_comercial: form.nombre_comercial.trim(),
      // Campos opcionales vacíos se omiten: el backend valida NIT y correo solo si vienen.
      nit: form.nit?.trim() || undefined,
      palabras_clave: form.palabras_clave?.trim() || undefined,
      email_contacto: form.email_contacto?.trim() || undefined,
      estado: form.estado ?? 'aprobada',
    }));
    setForm(vacio);
  };

  const confirmarMotivo = async () => {
    if (!motivoOp || motivo.trim().length < LONGITUD_MINIMA_MOTIVO) return;
    await run(() => cambiarEstadoEmpresaAdmin(motivoOp.id, motivoOp.estado, motivo.trim()));
    setMotivoOp(null);
    setMotivo('');
  };

  const campo = (key: keyof EmpresaCrear, label: string, type = 'text') => (
    <div><label>{label}</label><input type={type} value={String(form[key] ?? '')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>
  );

  return <>
    <form className="admin-form-grid station-form" onSubmit={handleSubmit}>
      {campo('nombre_comercial', 'Nombre comercial')}
      {campo('razon_social', 'Razon social')}
      {campo('nit', 'NIT (opcional, solo referencia)')}
      {campo('telefono', 'Telefono')}
      {campo('email_contacto', 'Correo de contacto', 'email')}
      {campo('direccion_sede', 'Direccion de la sede')}
      <div><label>Color de marca</label><input type="color" value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} /></div>
      {/* RN-E08: `pendiente` deja la empresa sin publicar hasta que el admin la apruebe. */}
      <div><label>Estado inicial</label><select value={form.estado ?? 'aprobada'} onChange={(e) => setForm({ ...form, estado: e.target.value as EmpresaCrear['estado'] })}>
        <option value="aprobada">Aprobada</option>
        <option value="pendiente">Pendiente</option>
      </select></div>
      <div className="full-width"><label>Descripcion</label><textarea rows={3} value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
      <div className="full-width"><label>Palabras clave de sus estaciones (separadas por coma)</label>
        <input value={form.palabras_clave ?? ''} onChange={(e) => setForm({ ...form, palabras_clave: e.target.value })} placeholder="enel x, enelx" />
        <small>Toda estacion del mapa cuyo nombre u operador contenga una de estas palabras pasa a esta empresa.</small>
      </div>
      <div className="full-width"><label>Cuenta de acceso</label><select value={modoCuenta} onChange={(e) => setModoCuenta(e.target.value as 'nueva' | 'existente')}>
        <option value="nueva">Crear una cuenta nueva</option>
        <option value="existente">Vincular un usuario ya registrado</option>
      </select></div>
      {modoCuenta === 'existente' ? campo('usuario_existente_email', 'Correo del usuario registrado (pasa a ser la cuenta de la empresa)', 'email') : <>
        {campo('usuario_nombre', 'Nombre del representante')}
        {campo('usuario_apellido', 'Apellido del representante')}
        {campo('usuario_email', 'Correo de acceso', 'email')}
        {campo('usuario_password', 'Contraseña inicial (8+ con mayúscula, número y símbolo)', 'password')}
      </>}
      <div className="full-width station-form-actions"><button type="submit" className="btn-save-estacion">Crear empresa</button></div>
    </form>

    <div className="panel-toolbar">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar empresa por nombre, NIT o correo" />
      <div className="filter-pills">
        {(['todos', 'aprobada', 'pendiente', 'suspendida'] as const).map((estado) => (
          <button key={estado} className={`pill ${estadoFiltro === estado ? 'active' : ''}`} onClick={() => setEstadoFiltro(estado)}>{estado === 'todos' ? 'Todas' : estado}</button>
        ))}
      </div>
    </div>

    <Table headers={['Empresa', 'Contacto', 'Estaciones', 'Palabras clave', 'Estado', 'Acciones']}>
      {filtradas.map((e) => <tr key={e.id}>
        <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: e.color_hex, marginRight: 6 }} /><strong>{e.nombre_comercial}</strong><br /><small>{e.razon_social || 'Sin razon social'}{e.nit ? ` - NIT ${e.nit}` : ''}</small></td>
        <td>{e.email_contacto || e.telefono || 'Sin contacto'}<br /><small>Acceso: {e.usuario_email || 'Sin correo'}</small><br /><small>{e.direccion_sede || 'Sin direccion'}</small></td>
        <td>{e.total_estaciones}</td>
        <td>{e.palabras_clave || <small>Sin palabras</small>}</td>
        <td><span className={`status-badge ${getStatusClass(e.estado)}`}>{e.estado}</span></td>
        <td>
          {e.estado !== 'aprobada' && <button className="btn-tbl" onClick={() => void run(() => cambiarEstadoEmpresaAdmin(e.id, 'aprobada'))}>Aprobar</button>}
          {e.estado !== 'suspendida' && <button className="btn-tbl danger" onClick={() => { setMotivoOp({ id: e.id, nombre: e.nombre_comercial, estado: 'suspendida' }); setMotivo(''); }}>Suspender</button>}
          <button className="btn-tbl" onClick={() => setPalabrasOp({ id: e.id, nombre: e.nombre_comercial, valor: e.palabras_clave || '' })}>Palabras clave</button>
        </td>
      </tr>)}
    </Table>

    {palabrasOp && <form className="admin-form-grid" onSubmit={(event) => {
      event.preventDefault();
      void run(() => cambiarPalabrasEmpresaAdmin(palabrasOp.id, palabrasOp.valor)).then(() => setPalabrasOp(null));
    }} style={{ marginTop: 20 }}>
      <div className="full-width">
        <label>{`Palabras clave de ${palabrasOp.nombre} (separadas por coma)`}</label>
        <input value={palabrasOp.valor} onChange={(e) => setPalabrasOp({ ...palabrasOp, valor: e.target.value })} placeholder="enel x, enelx" />
        <small>Las estaciones del mapa cuyo nombre u operador contenga una de estas palabras pasan a esta empresa.</small>
      </div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion">Guardar</button>
        {' '}<button type="button" className="btn-tbl" onClick={() => setPalabrasOp(null)}>Cancelar</button>
      </div>
    </form>}

    {motivoOp && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void confirmarMotivo(); }} style={{ marginTop: 20 }}>
      <div className="full-width">
        <label>{`Motivo para suspender ${motivoOp.nombre}`}</label>
        <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={`Minimo ${LONGITUD_MINIMA_MOTIVO} caracteres: la empresa recibe este motivo en sus notificaciones`} />
      </div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion" disabled={motivo.trim().length < LONGITUD_MINIMA_MOTIVO}>Suspender</button>
        {' '}<button type="button" className="btn-tbl" onClick={() => setMotivoOp(null)}>Cancelar</button>
      </div>
    </form>}
  </>;
}

function ProfilePanel({ usuario }: { usuario: { nombre?: string; apellido?: string; email?: string } | null }) {
  const [form, setForm] = useState({ nombre: usuario?.nombre || '', apellido: usuario?.apellido || '', email: usuario?.email || '' });
  const [passwordForm, setPasswordForm] = useState({ old_password: '', new_password: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setForm({ nombre: usuario?.nombre || '', apellido: usuario?.apellido || '', email: usuario?.email || '' });
  }, [usuario]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await actualizarPerfil({ nombre: form.nombre.trim(), apellido: form.apellido.trim(), email: form.email.trim() });
      if (passwordForm.new_password.trim()) {
        await cambiarPassword(passwordForm.old_password, passwordForm.new_password.trim());
      }
      if (passwordForm.new_password.trim()) {
        setPasswordForm({ old_password: '', new_password: '' });
      }
      const perfil = await obtenerPerfil();
      setForm({ nombre: perfil.usuario.nombre || '', apellido: perfil.usuario.apellido || '', email: perfil.usuario.email || '' });
      setMessage('Perfil actualizado correctamente.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const iniciales = `${(usuario?.nombre || 'A').charAt(0)}${(usuario?.apellido || '').charAt(0)}`.toUpperCase();
  return <div className="admin-profile-panel"><div className="profile-hero"><div className="profile-avatar">{iniciales}</div><div><h2>Mi perfil</h2><p>Administra tus datos y la seguridad de tu cuenta.</p></div><span className="profile-role"><i className="fa-solid fa-shield-halved"></i> Administrador</span></div>
    <form onSubmit={handleSubmit} className="admin-form-grid">
      <div className="profile-section-heading full-width"><i className="fa-solid fa-user"></i><span><strong>Datos personales</strong><small>Información visible en tu cuenta</small></span></div>
      <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
      <div><label>Apellido</label><input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></div>
      <div className="full-width"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div className="profile-section-heading full-width"><i className="fa-solid fa-lock"></i><span><strong>Seguridad</strong><small>Actualiza tu contraseña cuando lo necesites</small></span></div>
      <div className="full-width"><label>Contraseña actual</label><input type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} placeholder="Opcional si vas a cambiar la contraseña" /></div>
      <div className="full-width"><label>Nueva contraseña</label><input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="Escribe una nueva contraseña" /></div>
      <div className="full-width profile-actions"><button type="submit" className="btn-save-estacion" disabled={saving}>{saving ? 'Guardando...' : 'Guardar perfil'}</button></div>
      {message && <div className="full-width alert alert-success">{message}</div>}
    </form>
  </div>;
}

function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
