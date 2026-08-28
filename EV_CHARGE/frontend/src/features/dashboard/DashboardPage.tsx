import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/admin.css';
import '../../styles/dashboard_usuario.css';
import { useAuth } from '../../context/AuthContext';
import { listarVehiculos, crearVehiculo, actualizarVehiculo, eliminarVehiculo, type Vehiculo } from '../../api/vehiculos.api';
import { misReservas, crearReserva, cancelarReserva, type Reserva } from '../../api/reservas.api';
import { listarMetodosPago, crearMetodoPago, actualizarMetodoPago, eliminarMetodoPago, type MetodoPago } from '../../api/metodosPago.api';
import { listarFavoritos, quitarFavorito, type Favorito } from '../../api/favoritos.api';
import { misReportes, crearReporte, eliminarReporte, type Reporte } from '../../api/reportes.api';
import { misCalificaciones, calificar, eliminarCalificacion, type Calificacion } from '../../api/calificaciones.api';
import { obtenerPerfil, actualizarPerfil, cambiarPassword } from '../../api/auth.api';

const paneles = ['Inicio', 'Vehículos', 'Reservas', 'Pagos', 'Favoritos', 'Reportes', 'Calificaciones', 'Mi perfil'];
type Panel = typeof paneles[number];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operación';
}

function DashboardTable({ children }: { children: React.ReactNode }) {
  return <div className="table-wrap"><table><tbody>{children}</tbody></table></div>;
}

export function DashboardPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>('Inicio');
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [pagos, setPagos] = useState<MetodoPago[]>([]);
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mostrarVehiculo, setMostrarVehiculo] = useState(false);
  const [vehiculoEditando, setVehiculoEditando] = useState<string | null>(null);
  const [mostrarPago, setMostrarPago] = useState(false);
  const [pagoEditando, setPagoEditando] = useState<string | null>(null);
  const [mostrarReserva, setMostrarReserva] = useState(false);
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [mostrarCalificacion, setMostrarCalificacion] = useState(false);
  const [form, setForm] = useState({ marca: '', modelo: '', anio: '', autonomia_km: '', tipo_conector: 'CCS' });
  const [pagoForm, setPagoForm] = useState({ tipo: 'Tarjeta', numero: '' });
  const [reservaForm, setReservaForm] = useState({ estacion_ocm_id: '', estacion_nombre: '', inicio: '', fin: '' });
  const [reporteForm, setReporteForm] = useState({ estacion_ocm_id: '', estacion_nombre: '', tipo: 'averia', descripcion: '' });
  const [calificacionForm, setCalificacionForm] = useState({ estacion_ocm_id: '', estacion_nombre: '', puntaje: '5', comentario: '' });

  const cargarDatos = async () => {
    setCargando(true);
    setError('');
    try {
      const [v, r, p, f, re, c] = await Promise.all([listarVehiculos(), misReservas(), listarMetodosPago(), listarFavoritos(), misReportes(), misCalificaciones()]);
      setVehiculos(v); setReservas(r); setPagos(p); setFavoritos(f); setReportes(re); setCalificaciones(c);
    } catch (e) { setError(errorMessage(e)); } finally { setCargando(false); }
  };

  useEffect(() => { void cargarDatos(); }, []);

  const addVehiculo = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = { marca: form.marca, modelo: form.modelo, tipo_conector: form.tipo_conector, anio: form.anio ? Number(form.anio) : undefined, autonomia_km: form.autonomia_km ? Number(form.autonomia_km) : undefined };
      if (vehiculoEditando) await actualizarVehiculo(vehiculoEditando, payload); else await crearVehiculo(payload);
      setForm({ marca: '', modelo: '', anio: '', autonomia_km: '', tipo_conector: 'CCS' }); setMostrarVehiculo(false); await cargarDatos();
      setVehiculoEditando(null);
    } catch (e) { setError(errorMessage(e)); }
  };

  const addPago = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (pagoEditando) await actualizarMetodoPago(pagoEditando, { tipo: pagoForm.tipo, numero: pagoForm.numero.trim() }); else await crearMetodoPago({ tipo: pagoForm.tipo, numero: pagoForm.numero.trim(), estado: true });
      setPagoForm({ tipo: 'Tarjeta', numero: '' });
      setMostrarPago(false);
      setPagoEditando(null);
      await cargarDatos();
    } catch (e) { setError(errorMessage(e)); }
  };

  const addReserva = async (event: FormEvent) => {
    event.preventDefault();
    if (!reservaForm.estacion_ocm_id || !reservaForm.inicio || !reservaForm.fin || new Date(reservaForm.inicio) >= new Date(reservaForm.fin) || new Date(reservaForm.inicio) < new Date()) {
      setError('Revisa la estación y el rango de fechas de la reserva.');
      return;
    }
    try { await crearReserva({ estacion_ocm_id: reservaForm.estacion_ocm_id.trim(), estacion_nombre: reservaForm.estacion_nombre.trim(), fecha_hora_inicio: new Date(reservaForm.inicio).toISOString(), fecha_hora_fin: new Date(reservaForm.fin).toISOString() }); setReservaForm({ estacion_ocm_id: '', estacion_nombre: '', inicio: '', fin: '' }); setMostrarReserva(false); await cargarDatos(); } catch (e) { setError(errorMessage(e)); }
  };

  const addReporte = async (event: FormEvent) => {
    event.preventDefault();
    if (!reporteForm.estacion_ocm_id.trim()) { setError('El ID de la estación es obligatorio.'); return; }
    try { await crearReporte({ ...reporteForm, estacion_ocm_id: reporteForm.estacion_ocm_id.trim(), estacion_nombre: reporteForm.estacion_nombre.trim() }); setReporteForm({ estacion_ocm_id: '', estacion_nombre: '', tipo: 'averia', descripcion: '' }); setMostrarReporte(false); await cargarDatos(); } catch (e) { setError(errorMessage(e)); }
  };

  const addCalificacion = async (event: FormEvent) => {
    event.preventDefault();
    if (!calificacionForm.estacion_ocm_id.trim()) { setError('El ID de la estación es obligatorio.'); return; }
    try { await calificar({ ...calificacionForm, estacion_ocm_id: calificacionForm.estacion_ocm_id.trim(), estacion_nombre: calificacionForm.estacion_nombre.trim(), puntaje: Number(calificacionForm.puntaje) }); setCalificacionForm({ estacion_ocm_id: '', estacion_nombre: '', puntaje: '5', comentario: '' }); setMostrarCalificacion(false); await cargarDatos(); } catch (e) { setError(errorMessage(e)); }
  };

  const remove = async (action: () => Promise<unknown>) => { if (!window.confirm('¿Confirmas esta acción?')) return; try { await action(); await cargarDatos(); } catch (e) { setError(errorMessage(e)); } };
  const editarVehiculo = (vehiculo: Vehiculo) => { setVehiculoEditando(vehiculo.id); setForm({ marca: vehiculo.marca, modelo: vehiculo.modelo, anio: vehiculo.anio?.toString() || '', autonomia_km: vehiculo.autonomia_km?.toString() || '', tipo_conector: vehiculo.tipo_conector }); setMostrarVehiculo(true); };
  const activarVehiculo = async (vehiculo: Vehiculo) => { try { await actualizarVehiculo(vehiculo.id, { activo: true }); await cargarDatos(); } catch (e) { setError(errorMessage(e)); } };
  const editarPago = (pago: MetodoPago) => { setPagoEditando(pago.id); setPagoForm({ tipo: pago.tipo, numero: pago.numero }); setMostrarPago(true); };
  const cerrarSesion = () => { logout(); navigate('/'); };
  const title = panel === 'Mi perfil' ? 'Mi perfil' : panel;

  return <div className="dashboard-shell">
    <aside id="admin-sidebar">
      <div className="admin-brand"><img src="/img/logo.png" alt="EV Charge" /><span>EV Charge</span></div>
      <div className="admin-user-info-sidebar"><strong>{usuario?.nombre} {usuario?.apellido}</strong><small>{usuario?.email}</small></div>
      <nav className="admin-nav">{paneles.map((item) => <button key={item} className={`anav${panel === item ? ' active' : ''}`} onClick={() => setPanel(item)}>{item}</button>)}</nav>
      <div className="admin-nav-bottom"><Link className="anav" to="/mapa">Abrir mapa</Link><button className="anav danger" onClick={cerrarSesion}>Cerrar sesión</button></div>
    </aside>
    <main id="admin-content">
      <header id="admin-header"><div><h1>{title}</h1><p>{panel === 'Inicio' ? 'Bienvenido a tu dashboard' : 'Gestiona tu información de EV Charge'}</p></div><Link className="btn-form" to="/mapa">Mapa</Link></header>
      <section className="panel active">
        {error && <div className="alert alert-error">{error}</div>}
        {cargando ? <p className="empty">Cargando información...</p> : <>
          {panel === 'Inicio' && <><div className="kpi-grid"><div className="kpi-card"><div className="kpi-icon">Vehículos</div><div className="kpi-num">{vehiculos.length}</div></div><div className="kpi-card"><div className="kpi-icon">Reservas</div><div className="kpi-num">{reservas.filter((r) => r.estado !== 'cancelada').length}</div></div><div className="kpi-card"><div className="kpi-icon">Pagos</div><div className="kpi-num">{pagos.length}</div></div><div className="kpi-card"><div className="kpi-icon">Favoritos</div><div className="kpi-num">{favoritos.length}</div></div></div><div className="activity-box"><div className="box-title">Actividad reciente</div>{reservas.length ? reservas.slice(0, 5).map((r) => <div className="res-row" key={r.id}><span>{r.estacion_nombre || r.estacion_ocm_id}</span><span className="res-fecha">{new Date(r.fecha_hora_inicio).toLocaleString()}</span></div>) : <p className="empty">Todavía no tienes reservas.</p>}</div></>}
          {panel === 'Vehículos' && <><div className="panel-toolbar"><button className="pill" onClick={() => { setVehiculoEditando(null); setMostrarVehiculo((value) => !value); }}>{mostrarVehiculo ? 'Cerrar' : '+ Agregar vehículo'}</button></div>{mostrarVehiculo && <form className="admin-form-grid" onSubmit={addVehiculo}><h3 className="full-width">{vehiculoEditando ? 'Editar vehículo' : 'Nuevo vehículo'}</h3><label>Marca<input required value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></label><label>Modelo<input required value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></label><label>Año<input type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} /></label><label>Autonomía (km)<input type="number" value={form.autonomia_km} onChange={(e) => setForm({ ...form, autonomia_km: e.target.value })} /></label><label>Conector<select value={form.tipo_conector} onChange={(e) => setForm({ ...form, tipo_conector: e.target.value })}><option>CCS</option><option>Type 2</option><option>CHAdeMO</option><option>GB/T</option><option>J1772</option></select></label><button className="btn-form" type="submit">Guardar</button></form>}<DashboardTable>{vehiculos.map((v) => <tr key={v.id}><td><strong>{v.marca} {v.modelo}</strong><br /><small>{v.tipo_conector} {v.autonomia_km ? `· ${v.autonomia_km} km` : ''} · {v.activo ? 'Activo' : 'Inactivo'}</small></td><td>{!v.activo && <button className="btn-tbl" onClick={() => void activarVehiculo(v)}>Activar</button>} <button className="btn-tbl" onClick={() => editarVehiculo(v)}>Editar</button> <button className="btn-tbl danger" onClick={() => void remove(() => eliminarVehiculo(v.id))}>Eliminar</button></td></tr>)}{!vehiculos.length && <tr><td className="empty">No tienes vehículos registrados.</td></tr>}</DashboardTable></>}
          {panel === 'Reservas' && <><div className="panel-toolbar"><button className="pill" onClick={() => setMostrarReserva((value) => !value)}>{mostrarReserva ? 'Cerrar formulario' : '+ Nueva reserva'}</button></div>{mostrarReserva && <form className="admin-form-grid" onSubmit={addReserva}><label>ID estación<input required value={reservaForm.estacion_ocm_id} onChange={(e) => setReservaForm({ ...reservaForm, estacion_ocm_id: e.target.value })} /></label><label>Nombre de estación<input value={reservaForm.estacion_nombre} onChange={(e) => setReservaForm({ ...reservaForm, estacion_nombre: e.target.value })} /></label><label>Inicio<input required type="datetime-local" value={reservaForm.inicio} onChange={(e) => setReservaForm({ ...reservaForm, inicio: e.target.value })} /></label><label>Fin<input required type="datetime-local" value={reservaForm.fin} onChange={(e) => setReservaForm({ ...reservaForm, fin: e.target.value })} /></label><button className="btn-form" type="submit">Reservar</button></form>}<DashboardTable>{reservas.map((r) => <tr key={r.id}><td><strong>{r.estacion_nombre || r.estacion_ocm_id}</strong><br /><small>{new Date(r.fecha_hora_inicio).toLocaleString()} · {r.estado}</small></td><td>{r.estado !== 'cancelada' && <button className="btn-tbl danger" onClick={() => void remove(() => cancelarReserva(r.id))}>Cancelar</button>}</td></tr>)}{!reservas.length && <tr><td className="empty">No tienes reservas.</td></tr>}</DashboardTable></>}
          {panel === 'Pagos' && <><div className="panel-toolbar"><button className="pill" onClick={() => { setPagoEditando(null); setMostrarPago((value) => !value); }}>{mostrarPago ? 'Cerrar formulario' : '+ Agregar método'}</button></div>{mostrarPago && <form className="admin-form-grid payment-form" onSubmit={addPago}><h3 className="full-width">{pagoEditando ? 'Editar método' : 'Nuevo método'}</h3><label>Tipo<select value={pagoForm.tipo} onChange={(e) => setPagoForm({ ...pagoForm, tipo: e.target.value })}><option>Visa</option><option>Mastercard</option><option>American Express</option><option>Nequi</option><option>Daviplata</option><option>Otro</option></select></label><label>Número o cuenta<input required value={pagoForm.numero} onChange={(e) => setPagoForm({ ...pagoForm, numero: e.target.value })} placeholder="**** 1234" /></label><button className="btn-form" type="submit">Guardar método</button></form>}<DashboardTable>{pagos.map((p) => <tr key={p.id}><td><strong>{p.tipo}</strong><br /><small>Termina en {p.numero.slice(-4)} · Registrado {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</small></td><td><span className={`badge-estado ${p.estado ? 'activa' : 'cancelada'}`}>{p.estado ? 'Activo' : 'Inactivo'}</span></td><td><button className="btn-tbl" onClick={() => editarPago(p)}>Editar</button> <button className="btn-tbl danger" onClick={() => void remove(() => eliminarMetodoPago(p.id))}>Eliminar</button></td></tr>)}{!pagos.length && <tr><td className="empty" colSpan={3}>No tienes métodos de pago registrados.</td></tr>}</DashboardTable></>}
          {panel === 'Favoritos' && <DashboardTable>{favoritos.map((f) => <tr key={f.id}><td><strong>{f.estacion_nombre || 'Estación guardada'}</strong><br /><small>ID de estación: {f.estacion_ocm_id}</small></td><td><Link className="btn-tbl" to={`/mapa?estacion=${encodeURIComponent(f.estacion_ocm_id)}`}>Ver en mapa</Link> <button className="btn-tbl danger" onClick={() => void remove(() => quitarFavorito(f.estacion_ocm_id))}>Quitar</button></td></tr>)}{!favoritos.length && <tr><td className="empty" colSpan={2}>No tienes estaciones favoritas.</td></tr>}</DashboardTable>}
          {panel === 'Reportes' && <><div className="panel-toolbar"><button className="pill" onClick={() => setMostrarReporte((value) => !value)}>{mostrarReporte ? 'Cerrar formulario' : '+ Nuevo reporte'}</button></div>{mostrarReporte && <form className="admin-form-grid" onSubmit={addReporte}><label>ID estación<input required value={reporteForm.estacion_ocm_id} onChange={(e) => setReporteForm({ ...reporteForm, estacion_ocm_id: e.target.value })} /></label><label>Nombre de estación<input value={reporteForm.estacion_nombre} onChange={(e) => setReporteForm({ ...reporteForm, estacion_nombre: e.target.value })} /></label><label>Tipo<select value={reporteForm.tipo} onChange={(e) => setReporteForm({ ...reporteForm, tipo: e.target.value })}><option value="averia">Avería</option><option value="fuera_servicio">Fuera de servicio</option><option value="ocupado">Ocupado</option><option value="otro">Otro</option></select></label><label className="full-width">Descripción<textarea required value={reporteForm.descripcion} onChange={(e) => setReporteForm({ ...reporteForm, descripcion: e.target.value })} /></label><button className="btn-form" type="submit">Enviar reporte</button></form>}<DashboardTable>{reportes.map((r) => <tr key={r.id}><td><strong>{r.estacion_nombre || r.estacion_ocm_id}</strong><br /><small>{r.tipo} · {r.estado || 'abierto'}</small></td><td><button className="btn-tbl danger" onClick={() => void remove(() => eliminarReporte(r.id))}>Eliminar</button></td></tr>)}{!reportes.length && <tr><td className="empty">No tienes reportes.</td></tr>}</DashboardTable></>}
          {panel === 'Calificaciones' && <><div className="panel-toolbar"><button className="pill" onClick={() => setMostrarCalificacion((value) => !value)}>{mostrarCalificacion ? 'Cerrar formulario' : '+ Nueva calificación'}</button></div>{mostrarCalificacion && <form className="admin-form-grid" onSubmit={addCalificacion}><label>ID estación<input required value={calificacionForm.estacion_ocm_id} onChange={(e) => setCalificacionForm({ ...calificacionForm, estacion_ocm_id: e.target.value })} /></label><label>Nombre de estación<input value={calificacionForm.estacion_nombre} onChange={(e) => setCalificacionForm({ ...calificacionForm, estacion_nombre: e.target.value })} /></label><label>Puntaje<select value={calificacionForm.puntaje} onChange={(e) => setCalificacionForm({ ...calificacionForm, puntaje: e.target.value })}><option value="5">5 - Excelente</option><option value="4">4 - Muy buena</option><option value="3">3 - Buena</option><option value="2">2 - Regular</option><option value="1">1 - Mala</option></select></label><label className="full-width">Comentario<textarea value={calificacionForm.comentario} onChange={(e) => setCalificacionForm({ ...calificacionForm, comentario: e.target.value })} /></label><button className="btn-form" type="submit">Guardar calificación</button></form>}<DashboardTable>{calificaciones.map((c) => <tr key={c.id}><td><strong>{c.estacion_nombre || c.estacion_ocm_id}</strong><br /><small>{c.puntaje}/5 · {c.comentario || 'Sin comentario'}</small></td><td><button className="btn-tbl danger" onClick={() => void remove(() => eliminarCalificacion(c.id))}>Eliminar</button></td></tr>)}{!calificaciones.length && <tr><td className="empty">No tienes calificaciones.</td></tr>}</DashboardTable></>}
          {panel === 'Mi perfil' && <ProfileForm />}
        </>}
      </section>
    </main>
    <DashboardFooter />
  </div>;
}

function DashboardFooter() {
  return <footer className="footer"><div className="footer-inner"><div className="footer-brand"><img src="/img/logo.png" alt="EV Charge" className="footer-logo" /><p>Plataforma para localizar y gestionar estaciones de carga para vehículos eléctricos en Colombia.</p></div><div className="footer-links"><p className="footer-title">Navegación</p><Link to="/">Inicio</Link><Link to="/mapa">Mapa</Link></div><div className="footer-links"><p className="footer-title">Soporte</p><a href="mailto:contacto@evcharge.co">contacto@evcharge.co</a><span>Bogotá D.C., Colombia</span></div><div className="footer-links"><p className="footer-title">Información</p><span>Proyecto académico SENA ADSO</span><span>Versión 2.0</span></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} EV Charge · Todos los derechos reservados.</p></div></footer>;
}

function ProfileForm() {
  const { usuario } = useAuth();
  const [form, setForm] = useState({ nombre: usuario?.nombre || '', apellido: usuario?.apellido || '', email: usuario?.email || '' });
  const [passwords, setPasswords] = useState({ actual: '', nueva: '', confirmacion: '' });
  const [mostrarPassword, setMostrarPassword] = useState({ actual: false, nueva: false, confirmacion: false });
  const [mensaje, setMensaje] = useState('');
  const save = async (event: FormEvent) => { event.preventDefault(); try { await actualizarPerfil(form); setMensaje('Perfil actualizado'); await obtenerPerfil(); } catch (e) { setMensaje(errorMessage(e)); } };
  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwords.nueva.length < 8 || passwords.nueva !== passwords.confirmacion) { setMensaje('La nueva contraseña debe tener 8 caracteres y coincidir.'); return; }
    try { await cambiarPassword(passwords.actual, passwords.nueva); setPasswords({ actual: '', nueva: '', confirmacion: '' }); setMensaje('Contraseña actualizada correctamente.'); } catch (e) { setMensaje(errorMessage(e)); }
  };
  return <div className="profile-forms"><form className="admin-form-grid" onSubmit={save}><h3 className="full-width">Datos personales</h3><label>Nombre<input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></label><label>Apellido<input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} /></label><label className="full-width">Correo<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label><button className="btn-form" type="submit">Guardar cambios</button></form><form className="admin-form-grid" onSubmit={changePassword}><h3 className="full-width">Cambiar contraseña</h3><PasswordField label="Contraseña actual" value={passwords.actual} visible={mostrarPassword.actual} onChange={(value) => setPasswords({ ...passwords, actual: value })} onToggle={() => setMostrarPassword({ ...mostrarPassword, actual: !mostrarPassword.actual })} /><PasswordField label="Nueva contraseña" value={passwords.nueva} visible={mostrarPassword.nueva} onChange={(value) => setPasswords({ ...passwords, nueva: value })} onToggle={() => setMostrarPassword({ ...mostrarPassword, nueva: !mostrarPassword.nueva })} /><PasswordField label="Confirmar contraseña" value={passwords.confirmacion} visible={mostrarPassword.confirmacion} onChange={(value) => setPasswords({ ...passwords, confirmacion: value })} onToggle={() => setMostrarPassword({ ...mostrarPassword, confirmacion: !mostrarPassword.confirmacion })} /><button className="btn-form" type="submit">Actualizar contraseña</button>{mensaje && <p className="form-message">{mensaje}</p>}</form></div>;
}

function PasswordField({ label, value, visible, onChange, onToggle }: { label: string; value: string; visible: boolean; onChange: (value: string) => void; onToggle: () => void }) {
  return <label>{label}<span className="password-box"><input required type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} /><button type="button" className="password-eye" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} onClick={onToggle}><i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'}`}></i></button></span></label>;
}
