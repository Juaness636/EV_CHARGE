// Estaciones y cargadores de la empresa. El motivo es obligatorio al cambiar
// estado o borrar (RN-E04/E06/E08) y el backend responde cuántas reservas canceló.
import { useEffect, useState, type FormEvent } from 'react';
import { Table } from '../../components/Table';
import { EmpresaLayout, useEmpresa } from '../../layouts/EmpresaLayout';
import {
  LONGITUD_MINIMA_MOTIVO,
  TIPOS_CONECTOR,
  agregarCargador,
  actualizarCargador,
  actualizarEstacion,
  cambiarEstadoEstacion,
  crearEstacion,
  eliminarEstacion,
  listarEstaciones,
  quitarCargador,
  subirFotoEstacion,
  eliminarFotoEstacion,
  urlMedia,
  FOTOS_MAXIMAS_POR_ESTACION,
  type CargadorCreate,
  type EstacionEmpresa,
  type EstacionEmpresaCreate,
  type EstadoCargador,
  type EstadoEstacion,
  listarEstacionesApiEmpresa,
  cambiarEstadoEstacionApiEmpresa,
  type EstacionApiEmpresa,
} from '../../api/empresa.api';
import { fecha, estadoClase } from './comunes';

const estadoInicial = () => ({ nombre: '', direccion: '', lat: '', lon: '', descripcion: '', estado: 'activa' as EstadoEstacion });
const cargadorVacio = (numero = 1): CargadorCreate => ({ numero, tipo_conector: 'CCS', potencia_kw: 22, bahias: 1, estado: 'disponible' });
const siguienteNumero = (lista: Array<{ numero: number }>) => lista.reduce((max, c) => Math.max(max, c.numero || 0), 0) + 1;

export function EmpresaEstacionesPage() {
  return (
    <EmpresaLayout titulo="Estaciones">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const { puedeOperar } = useEmpresa();
  const [estaciones, setEstaciones] = useState<EstacionEmpresa[]>([]);
  const [form, setForm] = useState(estadoInicial());
  const [cargadores, setCargadores] = useState<CargadorCreate[]>([cargadorVacio()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [motivoOp, setMotivoOp] = useState<{ id: string; nombre: string; accion: 'estado' | 'borrar'; estado?: EstadoEstacion } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [cambios, setCambios] = useState<Record<string, { tipo_conector: string; potencia_kw: string; bahias: string }>>({});

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const lista = await listarEstaciones();
      setEstaciones(lista);
      setCambios(Object.fromEntries(lista.flatMap((e) => e.cargadores.filter((c) => c.id).map((c) => [
        c.id as string, { tipo_conector: c.tipo_conector, potencia_kw: String(c.potencia_kw), bahias: String(c.bahias || 1) },
      ]))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las estaciones.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void cargar(); }, []);

  const ejecutar = async (operacion: () => Promise<unknown>, exito?: string) => {
    setError('');
    setMensaje('');
    try {
      const resultado = await operacion();
      const canceladas = typeof resultado === 'object' && resultado && 'reservas_canceladas' in resultado
        ? Number((resultado as { reservas_canceladas: unknown }).reservas_canceladas) || 0
        : 0;
      setMensaje(exito || (canceladas > 0
        ? `Listo. Se cancelaron ${canceladas} reserva(s) futura(s).`
        : 'Guardado.'));
      await cargar();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operacion.');
      return false;
    }
  };

  const reiniciarFormulario = () => {
    setForm(estadoInicial());
    setCargadores([cargadorVacio()]);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const base = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      lat: Number(form.lat),
      lon: Number(form.lon),
      descripcion: form.descripcion.trim(),
      estado: form.estado,
    };
    if (!base.nombre || Number.isNaN(base.lat) || Number.isNaN(base.lon)) {
      setError('Nombre, latitud y longitud son obligatorios.');
      return;
    }

    if (editingId) {
      if (await ejecutar(() => actualizarEstacion(editingId, base), 'Estacion actualizada.')) reiniciarFormulario();
      return;
    }

    const limpios = cargadores
      .filter((c) => c.tipo_conector.trim() && Number(c.potencia_kw) > 0)
      .map((c, i) => ({ ...c, numero: c.numero || i + 1, potencia_kw: Number(c.potencia_kw), bahias: Number(c.bahias) || 1 }));
    if (limpios.length === 0) {
      setError('Agrega al menos un cargador (RN-E03).');
      return;
    }
    const payload: EstacionEmpresaCreate = { ...base, cargadores: limpios };
    if (await ejecutar(() => crearEstacion(payload), 'Estacion creada.')) reiniciarFormulario();
  };

  const confirmarMotivo = async () => {
    if (!motivoOp || motivo.trim().length < LONGITUD_MINIMA_MOTIVO) return;
    const texto = motivo.trim();
    if (motivoOp.accion === 'borrar') {
      await ejecutar(() => eliminarEstacion(motivoOp.id, texto));
    } else {
      await ejecutar(() => cambiarEstadoEstacion(motivoOp.id, motivoOp.estado as EstadoEstacion, texto));
    }
    setMotivoOp(null);
    setMotivo('');
  };

  const visibles = estaciones.filter((e) => !query || `${e.id} ${e.nombre} ${e.direccion}`.toLowerCase().includes(query.toLowerCase()));

  return <>
    {puedeOperar && <form className="admin-form-grid station-form" onSubmit={handleSubmit}>
      <div><label>ID de estacion</label><input value={editingId || ''} readOnly disabled={!editingId} placeholder={editingId ? '' : 'Se asigna al crear'} /></div>
      <div><label>Nombre</label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Estacion Centro" required /></div>
      <div className="full-width"><label>Direccion</label><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Cra 12 #34-56" /></div>
      <div><label>Latitud</label><input type="number" step="any" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="4.6097" /></div>
      <div><label>Longitud</label><input type="number" step="any" value={form.lon} onChange={(e) => setForm({ ...form, lon: e.target.value })} placeholder="-74.0817" /></div>
      <div><label>Estado</label><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoEstacion })}><option value="activa">Activa</option><option value="mantenimiento">Mantenimiento</option><option value="inactiva">Inactiva</option></select></div>
      <div className="full-width"><label>Descripcion</label><textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>

      <div className="full-width">
        <label>Cargadores</label>
        {!editingId && cargadores.map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 90px 70px 140px 40px', gap: 8, marginBottom: 8 }}>
            <input type="number" min={1} value={c.numero} aria-label="Numero" onChange={(e) => setCargadores(cargadores.map((item, j) => j === i ? { ...item, numero: Number(e.target.value) } : item))} />
            <select value={c.tipo_conector} aria-label="Conector" onChange={(e) => setCargadores(cargadores.map((item, j) => j === i ? { ...item, tipo_conector: e.target.value } : item))}>
              {TIPOS_CONECTOR.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
            <input type="number" step="any" value={c.potencia_kw} aria-label="Potencia (kW)" onChange={(e) => setCargadores(cargadores.map((item, j) => j === i ? { ...item, potencia_kw: Number(e.target.value) } : item))} />
            <input type="number" min={1} value={c.bahias ?? 1} aria-label="Bahías" onChange={(e) => setCargadores(cargadores.map((item, j) => j === i ? { ...item, bahias: Number(e.target.value) } : item))} />
            <select aria-label="Estado" value={c.estado || 'disponible'} onChange={(e) => setCargadores(cargadores.map((item, j) => j === i ? { ...item, estado: e.target.value as EstadoCargador } : item))}>
              <option value="disponible">Disponible</option>
              <option value="fuera_servicio">Fuera de servicio</option>
            </select>
            <button type="button" className="btn-tbl danger" disabled={cargadores.length === 1} onClick={() => setCargadores(cargadores.filter((_, j) => j !== i))}>x</button>
          </div>
        ))}
        {!editingId && <button type="button" className="btn-tbl" onClick={() => setCargadores([...cargadores, cargadorVacio(siguienteNumero(cargadores))])}>Agregar cargador</button>}
        {editingId && <p className="empty">Edita los cargadores desde la tabla de abajo.</p>}
      </div>

      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion">{editingId ? 'Guardar cambios' : 'Crear estacion'}</button>
        {editingId && <button type="button" className="btn-tbl" onClick={reiniciarFormulario}>Cancelar</button>}
      </div>
    </form>}

    <div className="panel-toolbar">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, id o direccion" />
    </div>

    {mensaje && <div className="alert alert-success">{mensaje}</div>}

    {cargando ? <p className="empty">Cargando...</p> : visibles.length === 0 ? (
      <p className="empty">No tienes estaciones registradas.</p>
    ) : visibles.map((estacion) => (
      <div className="section-box" key={estacion.id} style={{ marginBottom: 14 }}>
        <div className="box-title">
          {estacion.nombre}
          {' '}<span className={`status-badge ${estadoClase(estacion.estado)}`}>{estacion.estado}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          ID {estacion.id} · {estacion.direccion || 'Sin direccion'} · {estacion.cargadores_disponibles}/{estacion.total_cargadores} cargadores disponibles · {estacion.incidentes_abiertos} incidente(s) abierto(s) · creada el {fecha(estacion.created_at)}
        </div>

        <Table headers={['#', 'Conector', 'Potencia (kW)', 'Bahías', 'Estado', 'Acciones']}>
          {estacion.cargadores.filter((c) => c.id).map((c) => {
            const cargador = { ...c, id: c.id as string };
            const edit = cambios[cargador.id] || { tipo_conector: cargador.tipo_conector, potencia_kw: String(cargador.potencia_kw), bahias: String(cargador.bahias || 1) };
            const setCambio = (parcial: Partial<typeof edit>) => setCambios({ ...cambios, [cargador.id]: { ...edit, ...parcial } });
            return <tr key={cargador.id}>
              <td>{cargador.numero}</td>
              <td>
                <select value={edit.tipo_conector} disabled={!puedeOperar} onChange={(e) => setCambio({ tipo_conector: e.target.value })}>
                  {TIPOS_CONECTOR.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </td>
              <td><input type="number" step="any" value={edit.potencia_kw} disabled={!puedeOperar} onChange={(e) => setCambio({ potencia_kw: e.target.value })} /></td>
              <td><input type="number" min={1} value={edit.bahias} disabled={!puedeOperar} onChange={(e) => setCambio({ bahias: e.target.value })} /></td>
              <td><span className={`status-badge ${estadoClase(cargador.estado)}`}>{cargador.estado}</span></td>
              <td>
                {puedeOperar && <>
                  <button className="btn-tbl" onClick={() => void ejecutar(() => actualizarCargador(estacion.id, cargador.id, { tipo_conector: edit.tipo_conector.trim(), potencia_kw: Number(edit.potencia_kw), bahias: Number(edit.bahias) || 1 }), 'Cargador actualizado.')}>Guardar</button>
                  {' '}<button className="btn-tbl" onClick={() => void ejecutar(() => actualizarCargador(estacion.id, cargador.id, { estado: cargador.estado === 'disponible' ? 'fuera_servicio' : 'disponible' }), 'Cargador actualizado.')}>
                    {cargador.estado === 'disponible' ? 'Fuera de servicio' : 'Disponibilizar'}
                  </button>
                  {' '}<button className="btn-tbl danger" onClick={() => void ejecutar(() => quitarCargador(estacion.id, cargador.id), 'Cargador retirado.')}>Quitar</button>
                </>}
              </td>
            </tr>;
          })}
        </Table>

        {/* Fotos: las ven todos los usuarios en el detalle de la estación del mapa. */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Fotos ({(estacion.fotos || []).length}/{FOTOS_MAXIMAS_POR_ESTACION})</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {(estacion.fotos || []).map((foto) => (
              <div key={foto.id} style={{ position: 'relative' }}>
                <img src={urlMedia(foto.url)} alt={`Foto de ${estacion.nombre}`} style={{ width: 120, height: 84, objectFit: 'cover', borderRadius: 8 }} />
                {puedeOperar && <button type="button" className="btn-tbl danger" style={{ position: 'absolute', top: 4, right: 4, padding: '0 6px' }}
                  aria-label="Quitar foto" onClick={() => { if (window.confirm('¿Quitar esta foto?')) void ejecutar(() => eliminarFotoEstacion(estacion.id, foto.id), 'Foto eliminada.'); }}>×</button>}
              </div>
            ))}
            {puedeOperar && (estacion.fotos || []).length < FOTOS_MAXIMAS_POR_ESTACION && <label className="btn-tbl" style={{ cursor: 'pointer' }}>
              Agregar foto
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
                const archivo = e.target.files?.[0];
                e.target.value = '';
                if (archivo) void ejecutar(() => subirFotoEstacion(estacion.id, archivo), 'Foto subida.');
              }} />
            </label>}
          </div>
        </div>

        {puedeOperar && <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn-tbl" onClick={() => void ejecutar(() => agregarCargador(estacion.id, cargadorVacio(siguienteNumero(estacion.cargadores))), 'Cargador agregado.')}>Agregar cargador</button>
          <button className="btn-tbl" onClick={() => { setEditingId(estacion.id); setForm({ nombre: estacion.nombre, direccion: estacion.direccion, lat: String(estacion.lat), lon: String(estacion.lon), descripcion: estacion.descripcion || '', estado: estacion.estado }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Editar estacion</button>
          {estacion.estado !== 'activa' && <button className="btn-tbl primary" onClick={() => { setMotivoOp({ id: estacion.id, nombre: estacion.nombre, accion: 'estado', estado: 'activa' }); setMotivo(''); }}>Activar</button>}
          {estacion.estado !== 'mantenimiento' && <button className="btn-tbl" onClick={() => { setMotivoOp({ id: estacion.id, nombre: estacion.nombre, accion: 'estado', estado: 'mantenimiento' }); setMotivo(''); }}>Mantenimiento</button>}
          {estacion.estado !== 'inactiva' && <button className="btn-tbl" onClick={() => { setMotivoOp({ id: estacion.id, nombre: estacion.nombre, accion: 'estado', estado: 'inactiva' }); setMotivo(''); }}>Inactivar</button>}
          <button className="btn-tbl danger" onClick={() => { setMotivoOp({ id: estacion.id, nombre: estacion.nombre, accion: 'borrar' }); setMotivo(''); }}>Eliminar</button>
        </div>}
      </div>
    ))}

    {error && <div className="alert alert-error">{error}</div>}

    {motivoOp && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void confirmarMotivo(); }} style={{ marginTop: 16 }}>
      <div className="full-width">
        <label>{`Motivo para ${motivoOp.accion === 'borrar' ? 'eliminar' : `poner en ${motivoOp.estado}`} ${motivoOp.nombre}`}</label>
        <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={`Minimo ${LONGITUD_MINIMA_MOTIVO} caracteres. Se guarda en el historial y cancela las reservas futuras.`} />
      </div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion" disabled={motivo.trim().length < LONGITUD_MINIMA_MOTIVO}>Confirmar</button>
        {' '}<button type="button" className="btn-tbl" onClick={() => setMotivoOp(null)}>Cancelar</button>
      </div>
    </form>}

    <EstacionesApi />
  </>;
}

// Estaciones del mapa (OpenChargeMap) que el admin asignó a la empresa con palabras clave.
// No se crean ni se borran aquí: la empresa solo ve cuáles son suyas y les cambia el estado.
function EstacionesApi() {
  const { perfil, puedeOperar } = useEmpresa();
  const [lista, setLista] = useState<EstacionApiEmpresa[] | null>(null);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    listarEstacionesApiEmpresa()
      .then(setLista)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las estaciones del mapa.'));
  }, []);

  const cambiar = async (estacion: EstacionApiEmpresa, estado: EstacionApiEmpresa['estado']) => {
    setError('');
    setMensaje('');
    try {
      await cambiarEstadoEstacionApiEmpresa(estacion.id, estado);
      setLista((actual) => (actual || []).map((e) => (e.id === estacion.id ? { ...e, estado } : e)));
      setMensaje(`${estacion.nombre} quedó en estado ${estado}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el estado.');
    }
  };

  return <section style={{ marginTop: 28 }}>
    <h2>Estaciones del mapa asignadas</h2>
    <p>{perfil?.palabras_clave
      ? `Son las estaciones del mapa cuyo nombre u operador contiene: ${perfil.palabras_clave}.`
      : 'El administrador aun no te asigno palabras clave, asi que no tienes estaciones del mapa.'}</p>
    {error && <div className="alert alert-error">{error}</div>}
    {mensaje && <div className="alert alert-success">{mensaje}</div>}
    {lista === null && !error ? <p className="empty">Cargando...</p> : lista && lista.length > 0 ? (
      <Table headers={['Estacion', 'Ciudad', 'Operador', 'Estado']}>
        {lista.map((e) => <tr key={e.id}>
          <td><strong>{e.nombre}</strong><br /><small>{e.direccion}</small></td>
          <td>{e.ciudad || '-'}</td>
          <td>{e.operador}</td>
          <td>
            <select value={e.estado} disabled={!puedeOperar} onChange={(ev) => void cambiar(e, ev.target.value as EstacionApiEmpresa['estado'])}>
              <option value="activa">Activa</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="inactiva">Inactiva</option>
            </select>
          </td>
        </tr>)}
      </Table>
    ) : perfil?.palabras_clave ? <p className="empty">Ninguna estacion del mapa coincide con tus palabras clave.</p> : null}
  </section>;
}
