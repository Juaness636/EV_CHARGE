// Perfil de marca de la empresa y cambio de password de la cuenta.
import { useEffect, useState, type FormEvent } from 'react';
import { EmpresaLayout, useEmpresa } from '../../layouts/EmpresaLayout';
import { actualizarPerfilEmpresa, cambiarPasswordEmpresa } from '../../api/empresa.api';
import { fecha } from './comunes';

export function EmpresaPerfilPage() {
  return (
    <EmpresaLayout titulo="Perfil">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const { perfil, refrescar } = useEmpresa();
  const [form, setForm] = useState({ nombre_comercial: '', razon_social: '', telefono: '', email_contacto: '', direccion_sede: '', descripcion: '', color_hex: '#16a34a', logo_url: '' });
  const [password, setPassword] = useState({ old_password: '', new_password: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!perfil) return;
    setForm({
      nombre_comercial: perfil.nombre_comercial,
      razon_social: perfil.razon_social || '',
      telefono: perfil.telefono || '',
      email_contacto: perfil.email_contacto || '',
      direccion_sede: perfil.direccion_sede || '',
      descripcion: perfil.descripcion || '',
      color_hex: perfil.color_hex,
      logo_url: perfil.logo_url || '',
    });
  }, [perfil]);

  const guardar = async (event: FormEvent) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await actualizarPerfilEmpresa({ ...form, logo_url: form.logo_url.trim() || undefined });
      await refrescar();
      setMensaje('Perfil actualizado. El color de marca ya se usa en el mapa publico.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el perfil.');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarClave = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMensaje('');
    try {
      await cambiarPasswordEmpresa(password.old_password, password.new_password);
      setPassword({ old_password: '', new_password: '' });
      setMensaje('Password actualizada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el password.');
    }
  };

  if (!perfil) return <p className="empty">Cargando...</p>;

  return <>
    <div className="section-box" style={{ marginBottom: 16 }}>
      <div className="box-title">Cuenta</div>
      <div style={{ fontSize: 13 }}>
        Estado: <span className={`status-badge ${perfil.estado === 'aprobada' ? 'status-active' : 'status-pending'}`}>{perfil.estado}</span><br />
        <small>Correo de contacto: {perfil.email_contacto || '-'}</small><br />
        <small>Empresa desde: {fecha(perfil.created_at)}</small><br />
        <small>Estaciones: {perfil.total_estaciones}</small>
      </div>
    </div>

    {error && <div className="alert alert-error">{error}</div>}
    {mensaje && <div className="alert alert-success">{mensaje}</div>}

    <form className="admin-form-grid" onSubmit={guardar}>
      <div><label>Nombre comercial</label><input value={form.nombre_comercial} onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })} required /></div>
      <div><label>Razon social</label><input value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} /></div>
      <div><label>Telefono</label><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
      <div><label>Correo de contacto</label><input type="email" value={form.email_contacto} onChange={(e) => setForm({ ...form, email_contacto: e.target.value })} /></div>
      <div><label>Direccion de la sede</label><input value={form.direccion_sede} onChange={(e) => setForm({ ...form, direccion_sede: e.target.value })} /></div>
      <div><label>Color de marca</label><input type="color" value={form.color_hex} onChange={(e) => setForm({ ...form, color_hex: e.target.value })} /></div>
      <div className="full-width"><label>URL del logo</label><input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
      <div className="full-width"><label>Descripcion</label><textarea rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar perfil'}</button>
      </div>
    </form>

    <form className="admin-form-grid" onSubmit={cambiarClave} style={{ marginTop: 16 }}>
      <div><label>Password actual</label><input type="password" value={password.old_password} onChange={(e) => setPassword({ ...password, old_password: e.target.value })} required /></div>
      <div><label>Nueva password</label><input type="password" value={password.new_password} onChange={(e) => setPassword({ ...password, new_password: e.target.value })} required /></div>
      <div className="full-width station-form-actions"><button type="submit" className="btn-save-estacion">Cambiar password</button></div>
    </form>
  </>;
}
