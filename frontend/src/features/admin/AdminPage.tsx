import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/admin.css';
import { Table } from '../../components/Table';
import { useAuth } from '../../context/AuthContext';
import { obtenerPerfil, actualizarPerfil, cambiarPassword } from '../../api/auth.api';
import {
  obtenerEstadisticas, listarUsuarios, listarReportesAdmin, listarEstacionesOcmAdmin,
  listarReservasAdmin, listarCalificacionesAdmin, listarContactosAdmin, cambiarEstadoReporte,
  actualizarReservaAdmin, eliminarReservaAdmin, responderContactoAdmin,
  listarEstacionesAdmin, crearEstacion, actualizarEstacion, cambiarEstadoEstacion, eliminarEstacionAdmin,
  cambiarEstadoEstacionOcm, eliminarEstacionOcmAdmin, actualizarEstacionOcm,
  actualizarUsuarioAdmin,
  listarEmpresasAdmin, crearEmpresaAdmin, cambiarEstadoEmpresaAdmin,
  type AdminEstadisticas, type AdminReservaDetail, type ReporteAdmin, type CalificacionAdmin, type ContactoAdmin,
  type UserAdmin, type EmpresaCrear, type MarcaEmpresa,
} from '../../api/admin.api';
import type { EmpresaPerfil, EstadoEmpresa } from '../../api/empresa.api';

type Panel = 'Resumen' | 'Usuarios' | 'Reportes' | 'Estaciones' | 'Empresas' | 'Reservas' | 'Calificaciones' | 'Contactos' | 'Perfil';
type Row = Record<string, unknown>;
const panels: Panel[] = ['Resumen', 'Usuarios', 'Reportes', 'Estaciones', 'Empresas', 'Reservas', 'Calificaciones', 'Contactos', 'Perfil'];
// RN-E04/RN-E08: el backend exige al menos 10 caracteres al inhabilitar o borrar.
const LONGITUD_MINIMA_MOTIVO = 10;
const date = (value?: string) => value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin fecha';
const getStatusClass = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (value.includes('activa') || value.includes('resuelto')) return 'status-active';
  if (value.includes('mantenimiento') || value.includes('pendiente')) return 'status-pending';
  if (value.includes('inactiva') || value.includes('cerrado') || value.includes('descartado')) return 'status-inactive';
  return 'status-default';
};

export function AdminPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>('Resumen');
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<AdminEstadisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
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
            ? await Promise.all([listarEstacionesAdmin(), listarEstacionesOcmAdmin()]).then(([propias, externas]) => [...propias, ...externas])
            : panel === 'Empresas'
              ? await listarEmpresasAdmin()
              : panel === 'Reservas'
              ? await listarReservasAdmin()
              : panel === 'Calificaciones'
                ? await listarCalificacionesAdmin()
                : panel === 'Perfil'
                  ? []
                  : await listarContactosAdmin();
      setRows(data as Row[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la informacion.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [panel]);

  const run = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operacion.');
    }
  };

  return (
    <div className="dashboard-shell">
      <aside id="admin-sidebar">
        <div className="admin-brand"><img src="/img/logo.png" alt="EV Charge" /><span>EV Charge</span></div>
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
          {loading ? <p className="empty">Cargando...</p> : panel === 'Resumen' ? <Summary stats={stats} /> : panel === 'Usuarios' ? <Users rows={rows} /> : panel === 'Reportes' ? <Reports rows={rows as unknown as ReporteAdmin[]} run={run} /> : panel === 'Estaciones' ? <StationsAdmin rows={rows} run={run} /> : panel === 'Empresas' ? <EmpresasAdmin rows={rows as unknown as EmpresaPerfil[]} run={run} /> : panel === 'Reservas' ? <Reservations rows={rows as unknown as AdminReservaDetail[]} run={run} /> : panel === 'Calificaciones' ? <Ratings rows={rows as unknown as CalificacionAdmin[]} /> : panel === 'Contactos' ? <Contacts rows={rows as unknown as ContactoAdmin[]} run={run} /> : <ProfilePanel usuario={usuario} />}
        </section>
      </main>
    </div>
  );
}

function Summary({ stats }: { stats: AdminEstadisticas | null }) {
  const cards = stats ? [['Usuarios', stats.total_usuarios], ['Vehiculos', stats.total_vehiculos], ['Reservas activas', stats.total_reservas_activas], ['Cargas', stats.total_cargas], ['Reportes abiertos', stats.total_reportes_abiertos], ['Estaciones propias', stats.total_estaciones_propias], ['Empresas', stats.total_empresas], ['Empresas pendientes', stats.empresas_pendientes]] : [];
  return <div className="kpi-grid">{cards.map(([name, count]) => <div className="kpi-card" key={String(name)}><div className="kpi-label">{name}</div><div className="kpi-num">{String(count)}</div></div>)}</div>;
}

function Users({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '' });

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
    <Table headers={['Nombre y apellidos', 'Correo', 'Fecha de creacion', 'Acciones']}>
      {filteredRows.map((r) => <tr key={String(r.id)}>
        <td><strong>{String(r.nombre || '')} {String(r.apellido || '')}</strong></td>
        <td>{String(r.email || '')}</td>
        <td>{date(String(r.created_at || ''))}</td>
        <td>
          <button className="btn-tbl" onClick={() => { setEditingId(String(r.id)); setForm({ nombre: String(r.nombre || ''), apellido: String(r.apellido || ''), email: String(r.email || '') }); }}>Editar</button>
        </td>
      </tr>)}
    </Table>

    {editingId && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void handleSave(); }} style={{ marginTop: 20 }}>
      <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
      <div><label>Apellido</label><input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></div>
      <div className="full-width"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div className="full-width">
        <button className="btn-save-estacion" type="submit">Guardar cambios</button>
        <button className="btn-tbl" type="button" onClick={() => setEditingId(null)} style={{ marginLeft: 10 }}>Cancelar</button>
      </div>
    </form>}
  </>;
}

function Reports({ rows, run }: { rows: ReporteAdmin[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const [filtro, setFiltro] = useState<'todos' | 'abierto' | 'resuelto' | 'descartado'>('todos');
  const filas = filtro === 'todos' ? rows : rows.filter((r) => r.estado === filtro);

  return <>
    <div className="panel-toolbar">
      <div className="filter-pills">
        {(['todos', 'abierto', 'resuelto', 'descartado'] as const).map((estado) => (
          <button key={estado} className={`pill ${filtro === estado ? 'active' : ''}`} onClick={() => setFiltro(estado)}>{estado === 'todos' ? 'Todos' : estado}</button>
        ))}
      </div>
    </div>
    <Table headers={['Estacion y usuario', 'Comentario', 'Fecha', 'Acciones']}>
      {filas.map((r) => <tr key={r.id}><td><strong>{r.estacion_nombre || r.estacion_ocm_id}</strong><br /><small>Usuario: {r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido || ''}` : r.usuario_id}</small><br /><small>{r.usuario?.email}</small></td><td><strong>{r.tipo}</strong><br />{r.descripcion || 'Sin comentario'}</td><td>{date(r.fecha)}</td><td><span className={`status-badge ${getStatusClass(r.estado)}`}>{r.estado}</span><br /><button className="btn-tbl" onClick={() => void run(() => cambiarEstadoReporte(r.id, 'resuelto'))}>Resolver</button> <button className="btn-tbl" onClick={() => void run(() => cambiarEstadoReporte(r.id, 'abierto'))}>Reabrir</button></td></tr>)}
    </Table>
  </>;
}

function Reservations({ rows, run }: { rows: AdminReservaDetail[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fecha_hora_inicio: '', fecha_hora_fin: '', estado: 'activa' as string });

  const openEditor = (r: AdminReservaDetail) => {
    setEditingId(r.id);
    setEditForm({
      fecha_hora_inicio: r.fecha_hora_inicio ? new Date(r.fecha_hora_inicio).toISOString().slice(0, 16) : '',
      fecha_hora_fin: r.fecha_hora_fin ? new Date(r.fecha_hora_fin).toISOString().slice(0, 16) : '',
      estado: r.estado || 'activa',
    });
  };

  const saveReservation = async () => {
    if (!editingId) return;
    await run(() => actualizarReservaAdmin(editingId, {
      fecha_hora_inicio: editForm.fecha_hora_inicio,
      fecha_hora_fin: editForm.fecha_hora_fin,
      estado: editForm.estado,
    }));
    setEditingId(null);
  };

  return <>
    <Table headers={['Estacion', 'Usuario', 'Fechas', 'Acciones']}>
      {rows.map((r) => <tr key={r.id}><td>{r.estacion_nombre || r.estacion_ocm_id}</td><td><strong>{r.usuario ? `${r.usuario.nombre} ${r.usuario.apellido || ''}` : r.usuario_id}</strong><br /><small>{r.usuario?.email}</small></td><td>{date(r.fecha_hora_inicio)}<br /><small>Hasta: {date(r.fecha_hora_fin)}</small></td><td><span className={`status-badge ${getStatusClass(r.estado)}`}>{r.estado}</span><br /><button className="btn-tbl" onClick={() => openEditor(r)}>Editar</button> <button className="btn-tbl" onClick={() => void run(() => actualizarReservaAdmin(r.id, { estado: r.estado === 'activa' ? 'cancelada' : 'activa' }))}>{r.estado === 'activa' ? 'Desactivar' : 'Activar'}</button> <button className="btn-tbl danger" onClick={() => void run(() => eliminarReservaAdmin(r.id))}>Eliminar</button></td></tr>)}
    </Table>

    {editingId && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void saveReservation(); }} style={{ marginTop: 20 }}>
      <div><label>Inicio</label><input type="datetime-local" value={editForm.fecha_hora_inicio} onChange={(e) => setEditForm({ ...editForm, fecha_hora_inicio: e.target.value })} /></div>
      <div><label>Fin</label><input type="datetime-local" value={editForm.fecha_hora_fin} onChange={(e) => setEditForm({ ...editForm, fecha_hora_fin: e.target.value })} /></div>
      <div><label>Estado</label><select value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}><option value="activa">Activa</option><option value="cancelada">Cancelada</option><option value="pendiente">Pendiente</option></select></div>
      <div className="full-width"><button className="btn-save-estacion" type="submit">Guardar reserva</button> <button className="btn-tbl" type="button" onClick={() => setEditingId(null)}>Cancelar</button></div>
    </form>}
  </>;
}

function Ratings({ rows }: { rows: CalificacionAdmin[] }) {
  return <Table headers={['Estacion y usuario', 'Estrellas', 'Comentario', 'Fecha']}>{rows.map((r) => <tr key={r.id}><td><strong>{r.estacion_nombre || r.estacion_ocm_id}</strong><br /><small>{r.usuario_nombre || r.usuario_id}</small></td><td><span className="rating-stars">{'★'.repeat(r.puntaje)}<span>{'★'.repeat(5 - r.puntaje)}</span></span> {r.puntaje}/5</td><td>{r.comentario || 'Sin comentario'}</td><td>{date(r.fecha)}</td></tr>)}</Table>;
}

function Contacts({ rows, run }: { rows: ContactoAdmin[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  return <Table headers={['Usuario', 'Mensaje', 'Fecha', 'Respuesta']}>{rows.map((r) => <tr key={r.id}><td><strong>{r.nombre} {r.apellido || ''}</strong><br /><small>{r.correo}</small></td><td>{r.mensaje}</td><td>{date(r.fecha_envio)}<br /><span className={`status-badge ${getStatusClass(r.estado)}`}>{r.estado}</span></td><td>{open === r.id ? <><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe la respuesta" /><button className="btn-tbl" disabled={!reply.trim()} onClick={() => { void run(() => responderContactoAdmin(r.id, reply.trim())); setOpen(null); setReply(''); }}>Enviar</button></> : <><div>{r.respuesta || 'Sin respuesta'}</div><button className="btn-tbl" onClick={() => { setOpen(r.id); setReply(r.respuesta || ''); }}>Responder</button></>}</td></tr>)}</Table>;
}

function StationsAdmin({ rows, run }: { rows: Row[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    id: '', nombre: '', direccion: '', lat: '', lon: '', tipo_conector: 'CCS', potencia_kw: '', descripcion: '', operador: 'EV Charge', estado: 'activa',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingExterna, setEditingExterna] = useState(false);
  const [motivoOp, setMotivoOp] = useState<{ id: string; nombre: string; accion: 'estado' | 'borrar'; estado?: string; empresaId?: string; externa: boolean } | null>(null);
  const [motivo, setMotivo] = useState('');
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
    setEditingExterna(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const estado = form.estado as 'activa' | 'mantenimiento' | 'inactiva';

    if (editingId && editingExterna) {
      await run(() => actualizarEstacionOcm(editingId, {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim(),
        operador: form.operador.trim(),
        lat: Number(form.lat),
        lon: Number(form.lon),
        estado,
      }));
      resetForm();
      return;
    }

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
      estado,
    };

    if (!payload.nombre || Number.isNaN(payload.lat) || Number.isNaN(payload.lon) || Number.isNaN(payload.potencia_kw)) {
      return;
    }

    if (editingId) {
      await run(() => actualizarEstacion(editingId, payload));
    } else {
      await run(() => crearEstacion(payload));
    }
    resetForm();
  };

  const abrirMotivo = (row: Row, accion: 'estado' | 'borrar', estado?: string) => {
    setMotivoOp({
      id: String(row.id),
      nombre: String(row.nombre || row.id),
      accion,
      estado,
      empresaId: row.empresa_id ? String(row.empresa_id) : undefined,
      externa: String(row.origen || '') === 'OpenChargeMap',
    });
    setMotivo('');
  };

  const confirmarMotivo = async () => {
    if (!motivoOp) return;
    const texto = motivo.trim();
    if (!motivoOp.externa && texto.length < LONGITUD_MINIMA_MOTIVO) return;

    if (motivoOp.accion === 'borrar') {
      await run(() => (motivoOp.externa ? eliminarEstacionOcmAdmin(motivoOp.id) : eliminarEstacionAdmin(motivoOp.id, texto)));
    } else {
      const estado = motivoOp.estado as 'activa' | 'mantenimiento' | 'inactiva';
      await run(() => (motivoOp.externa
        ? cambiarEstadoEstacionOcm(motivoOp.id, estado)
        // Las estaciones de empresa se manejan con su `empresa_id`: sin él, el backend
        // buscaría en las de EV Charge y respondería 404.
        : cambiarEstadoEstacion(motivoOp.id, estado, texto, motivoOp.empresaId)));
    }
    setMotivoOp(null);
    setMotivo('');
  };

  return <>
    <form className="admin-form-grid station-form" onSubmit={handleSubmit}>
      <div><label>ID de estación</label><input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="Ej. EV-001" /></div>
      <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la estación" required /></div>
      <div><label>Proveedor</label><input value={form.operador} onChange={(e) => setForm({ ...form, operador: e.target.value })} placeholder="EV Charge" /></div>
      <div><label>Dirección</label><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Cra 123 #45-67" /></div>
      <div><label>Latitud</label><input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="4.711" /></div>
      <div><label>Longitud</label><input type="number" step="any" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} placeholder="-74.072" /></div>
      <div><label>Tipo de conector</label><input value={form.tipo_conector} onChange={(e) => setForm({ ...form, tipo_conector: e.target.value })} placeholder="CCS" /></div>
      <div><label>Potencia (kW)</label><input type="number" step="any" value={form.potencia_kw} onChange={(e) => setForm({ ...form, potencia_kw: e.target.value })} placeholder="22" /></div>
      <div className="full-width"><label>Descripción</label><textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} placeholder="Detalles relevantes de la estación" /></div>
      <div><label>Estado</label><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}><option value="activa">Activa</option><option value="mantenimiento">Mantenimiento</option><option value="inactiva">Inactiva</option></select></div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion">{editingId ? 'Guardar cambios' : 'Crear estación'}</button>
        {editingId && <button type="button" className="btn-tbl" onClick={resetForm}>Cancelar</button>}
      </div>
    </form>

    <div className="panel-toolbar">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar estación por ID, nombre o proveedor" />
      <div className="filter-pills">
        {(['todos', 'activa', 'mantenimiento', 'inactiva'] as const).map((estado) => (
          <button key={estado} className={`pill ${estadoFiltro === estado ? 'active' : ''}`} onClick={() => setEstadoFiltro(estado)}>{estado === 'todos' ? 'Todos' : estado}</button>
        ))}
      </div>
    </div>

    <Table headers={['Estacion', 'Proveedor', 'Empresa', 'Estado', 'Acciones']}>
      {filteredRows.map((r) => {
        const marca = r.empresa as MarcaEmpresa | null | undefined;
        const id = String(r.id);
        const activa = String(r.estado) === 'activa';
        return <tr key={id}>
          <td>{String(r.nombre || '')}<br /><small>ID: {id}</small></td>
          <td>{String(r.operador || '')}</td>
          <td>{marca ? <><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: marca.color_hex, marginRight: 6 }} />{marca.nombre}</> : 'EV Charge'}</td>
          <td><span className={`status-badge ${getStatusClass(String(r.estado || ''))}`}>{String(r.estado || '')}</span></td>
          <td>
            <button className="btn-tbl" onClick={() => { setEditingId(id); setEditingExterna(String(r.origen || '') === 'OpenChargeMap'); setForm({ id, nombre: String(r.nombre || ''), direccion: String(r.direccion || ''), lat: String(r.lat ?? ''), lon: String(r.lon ?? ''), tipo_conector: String(r.tipo_conector || 'CCS'), potencia_kw: String(r.potencia_kw ?? ''), descripcion: String(r.descripcion || ''), operador: String(r.operador || 'EV Charge'), estado: String(r.estado || 'activa') }); }}>Editar</button>
            {' '}<button className="btn-tbl" onClick={() => abrirMotivo(r, 'estado', activa ? 'inactiva' : 'activa')}>{activa ? 'Desactivar' : 'Activar'}</button>
            {' '}<button className="btn-tbl" onClick={() => abrirMotivo(r, 'estado', 'mantenimiento')}>Mantenimiento</button>
            {' '}<button className="btn-tbl danger" onClick={() => abrirMotivo(r, 'borrar')}>Eliminar</button>
          </td>
        </tr>;
      })}
    </Table>

    {motivoOp && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void confirmarMotivo(); }} style={{ marginTop: 20 }}>
      <div className="full-width">
        <label>{`Motivo: ${motivoOp.accion === 'borrar' ? 'eliminar' : 'dejar en ' + motivoOp.estado} la estacion ${motivoOp.nombre}${motivoOp.externa ? ' (opcional)' : ''}`}</label>
        <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={`Minimo ${LONGITUD_MINIMA_MOTIVO} caracteres`} />
      </div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion" disabled={!motivoOp.externa && motivo.trim().length < LONGITUD_MINIMA_MOTIVO}>Confirmar</button>
        {' '}<button type="button" className="btn-tbl" onClick={() => setMotivoOp(null)}>Cancelar</button>
      </div>
    </form>}
  </>;
}

function EmpresasAdmin({ rows, run }: { rows: EmpresaPerfil[]; run: (f: () => Promise<unknown>) => Promise<void> }) {
  const vacio: EmpresaCrear = {
    nombre_comercial: '', razon_social: '', nit: '', telefono: '', email_contacto: '', direccion_sede: '',
    descripcion: '', color_hex: '#16a34a', usuario_nombre: '', usuario_apellido: '', usuario_email: '', usuario_password: '',
  };
  const [form, setForm] = useState<EmpresaCrear>(vacio);
  const [query, setQuery] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | EstadoEmpresa>('todos');
  const [motivoOp, setMotivoOp] = useState<{ id: string; nombre: string; estado: EstadoEmpresa } | null>(null);
  const [motivo, setMotivo] = useState('');

  const filtradas = rows.filter((e) => {
    const texto = `${e.nombre_comercial} ${e.razon_social || ''} ${e.nit || ''} ${e.email_contacto || ''}`.toLowerCase();
    return (!query || texto.includes(query.toLowerCase())) && (estadoFiltro === 'todos' || e.estado === estadoFiltro);
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.nombre_comercial.trim().length < 2 || !form.usuario_email.trim() || form.usuario_password.length < 8) return;
    await run(() => crearEmpresaAdmin({
      ...form,
      nombre_comercial: form.nombre_comercial.trim(),
      usuario_email: form.usuario_email.trim(),
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
      {campo('nit', 'NIT')}
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
      {campo('usuario_nombre', 'Nombre del representante')}
      {campo('usuario_apellido', 'Apellido del representante')}
      {campo('usuario_email', 'Correo de acceso', 'email')}
      {campo('usuario_password', 'Password inicial (minimo 8)', 'password')}
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

    <Table headers={['Empresa', 'Contacto', 'Estaciones', 'Estado', 'Acciones']}>
      {filtradas.map((e) => <tr key={e.id}>
        <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: e.color_hex, marginRight: 6 }} /><strong>{e.nombre_comercial}</strong><br /><small>{e.razon_social || 'Sin razon social'}{e.nit ? ` - NIT ${e.nit}` : ''}</small></td>
        <td>{e.email_contacto || e.telefono || 'Sin contacto'}<br /><small>{e.direccion_sede || 'Sin direccion'}</small></td>
        <td>{e.total_estaciones}</td>
        <td><span className={`status-badge ${getStatusClass(e.estado)}`}>{e.estado}</span></td>
        <td>
          {e.estado !== 'aprobada' && <button className="btn-tbl" onClick={() => void run(() => cambiarEstadoEmpresaAdmin(e.id, 'aprobada'))}>Aprobar</button>}
          {e.estado !== 'suspendida' && <button className="btn-tbl danger" onClick={() => { setMotivoOp({ id: e.id, nombre: e.nombre_comercial, estado: 'suspendida' }); setMotivo(''); }}>Suspender</button>}
        </td>
      </tr>)}
    </Table>

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

  return <div className="admin-profile-panel"><h2>Mi perfil</h2>
    <form onSubmit={handleSubmit} className="admin-form-grid">
      <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></div>
      <div><label>Apellido</label><input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></div>
      <div className="full-width"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div className="full-width"><label>Contraseña actual</label><input type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} placeholder="Opcional si vas a cambiar la contraseña" /></div>
      <div className="full-width"><label>Nueva contraseña</label><input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} placeholder="Escribe una nueva contraseña" /></div>
      <div className="full-width"><button type="submit" className="btn-save-estacion" disabled={saving}>{saving ? 'Guardando...' : 'Guardar perfil'}</button></div>
      {message && <div className="full-width alert alert-success">{message}</div>}
    </form>
  </div>;
}
