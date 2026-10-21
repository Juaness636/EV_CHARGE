// Fase 5: bandeja de reportes de usuarios e incidentes propios de la empresa.
// El cierre del último incidente bloqueante devuelve `puede_reactivar` (RN-E07):
// se propone la reactivación, la empresa la confirma con un motivo.
import { useEffect, useState, type FormEvent } from 'react';
import { Table } from '../../components/Table';
import { EmpresaLayout, useEmpresa } from '../../layouts/EmpresaLayout';
import {
  LONGITUD_MINIMA_MOTIVO,
  cambiarEstadoEstacion,
  cambiarEstadoIncidente,
  cambiarEstadoReporte,
  crearIncidente,
  listarEstaciones,
  listarIncidentes,
  listarReportes,
  reporteAIncidente,
  type EstacionEmpresa,
  type EstadoIncidente,
  type EstadoReporte,
  type IncidenteEmpresa,
  type Paginado,
  type PrioridadIncidente,
  type ReporteEmpresa,
} from '../../api/empresa.api';
import { fecha, estadoClase } from './comunes';

const TRANSICIONES: Record<EstadoIncidente, EstadoIncidente[]> = {
  abierto: ['en_progreso', 'cerrado'],
  en_progreso: ['resuelto', 'cerrado'],
  resuelto: ['cerrado', 'en_progreso'],
  cerrado: [],
};
const TIPOS_INCIDENTE = ['falla', 'reparacion', 'actualizacion'];
const TIPOS_REPORTE: EstadoReporte[] = ['abierto', 'resuelto', 'descartado'];
const TAMANO_PAGINA = 10;

export function EmpresaIncidentesPage() {
  return (
    <EmpresaLayout titulo="Reportes e incidentes">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const { puedeOperar } = useEmpresa();
  const [pestana, setPestana] = useState<'reportes' | 'incidentes'>('reportes');
  const [estaciones, setEstaciones] = useState<EstacionEmpresa[]>([]);
  const [reportes, setReportes] = useState<Paginado<ReporteEmpresa> | null>(null);
  const [incidentes, setIncidentes] = useState<Paginado<IncidenteEmpresa> | null>(null);
  const [estadoReporte, setEstadoReporte] = useState<'todos' | EstadoReporte>('todos');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [reactivar, setReactivar] = useState<{ estacion_id: string; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [nuevo, setNuevo] = useState({ estacion_id: '', cargador_id: '', tipo: 'falla', titulo: '', descripcion: '', prioridad: 'media' as PrioridadIncidente, bloquea_estacion: false });
  const [cierre, setCierre] = useState<{ id: string; destino: EstadoIncidente; nombre: string } | null>(null);
  const [solucion, setSolucion] = useState('');

  const cargar = async () => {
    setError('');
    try {
      const [lista, dados] = await Promise.all([
        estaciones.length ? Promise.resolve(estaciones) : listarEstaciones(),
        pestana === 'reportes'
          ? listarReportes({ estado: estadoReporte === 'todos' ? undefined : estadoReporte, page, limit: TAMANO_PAGINA })
          : listarIncidentes({ page, limit: TAMANO_PAGINA }),
      ]);
      setEstaciones(lista as EstacionEmpresa[]);
      if (pestana === 'reportes') setReportes(dados as Paginado<ReporteEmpresa>);
      else setIncidentes(dados as Paginado<IncidenteEmpresa>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la bandeja.');
    }
  };

  useEffect(() => { void cargar(); }, [pestana, estadoReporte, page]);

  const ejecutar = async (operacion: () => Promise<unknown>, exito = 'Listo.') => {
    setError('');
    setMensaje('');
    try {
      const resultado = await operacion();
      await cargar();
      const incidente = resultado as IncidenteEmpresa | undefined;
      if (incidente && typeof incidente === 'object' && 'puede_reactivar' in incidente && incidente.puede_reactivar) {
        const estacion = estaciones.find((e) => e.id === incidente.estacion_id);
        setReactivar({ estacion_id: incidente.estacion_id, nombre: estacion?.nombre || incidente.estacion_nombre });
        setMensaje('Ultimo incidente bloqueante cerrado: puedes reactivar la estacion.');
        return;
      }
      setMensaje(exito);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operacion.');
    }
  };

  const crearIncidenteDesdeFormulario = async (event: FormEvent) => {
    event.preventDefault();
    if (!nuevo.estacion_id || !nuevo.titulo.trim()) {
      setError('Selecciona la estacion y escribe un titulo.');
      return;
    }
    await ejecutar(() => crearIncidente({
      estacion_id: nuevo.estacion_id,
      cargador_id: nuevo.cargador_id || undefined,
      tipo: nuevo.tipo,
      titulo: nuevo.titulo.trim(),
      descripcion: nuevo.descripcion.trim() || undefined,
      prioridad: nuevo.prioridad,
      bloquea_estacion: nuevo.bloquea_estacion,
    }), 'Incidente abierto.');
    setNuevo({ ...nuevo, titulo: '', descripcion: '', cargador_id: '' });
  };

  const confirmarReactivar = async () => {
    if (!reactivar || motivo.trim().length < LONGITUD_MINIMA_MOTIVO) return;
    await ejecutar(() => cambiarEstadoEstacion(reactivar.estacion_id, 'activa', motivo.trim()), 'Estacion reactivada.');
    setReactivar(null);
    setMotivo('');
  };

  const cerrarIncidente = async (event: FormEvent) => {
    event.preventDefault();
    if (!cierre || !solucion.trim()) return;
    await ejecutar(() => cambiarEstadoIncidente(cierre.id, cierre.destino, solucion.trim()), `Incidente en ${cierre.destino}.`);
    setCierre(null);
    setSolucion('');
  };

  const estacionSeleccionada = estaciones.find((e) => e.id === nuevo.estacion_id);
  const paginacion = (total: number) => (
    <div className="panel-toolbar" style={{ marginTop: 10 }}>
      <button className="btn-tbl" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
      <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>Pagina {page} de {Math.max(1, Math.ceil(total / TAMANO_PAGINA))} · {total} registro(s)</span>
      <button className="btn-tbl" disabled={page * TAMANO_PAGINA >= total} onClick={() => setPage(page + 1)}>Siguiente</button>
    </div>
  );

  return <>
    <div className="filter-pills" style={{ marginBottom: 14 }}>
      {(['reportes', 'incidentes'] as const).map((item) => (
        <button key={item} className={`pill ${pestana === item ? 'active' : ''}`} onClick={() => { setPestana(item); setPage(1); }}>
          {item === 'reportes' ? 'Reportes de usuarios' : 'Incidentes'}
        </button>
      ))}
    </div>

    {mensaje && <div className="alert alert-success">{mensaje}</div>}
    {error && <div className="alert alert-error">{error}</div>}

    {reactivar && <form className="admin-form-grid" onSubmit={(event) => { event.preventDefault(); void confirmarReactivar(); }}>
      <div className="full-width">
        <label>{`Reactivar ${reactivar.nombre}`}</label>
        <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={`Motivo de la reactivacion (minimo ${LONGITUD_MINIMA_MOTIVO} caracteres)`} />
      </div>
      <div className="full-width station-form-actions">
        <button type="submit" className="btn-save-estacion" disabled={motivo.trim().length < LONGITUD_MINIMA_MOTIVO}>Reactivar estacion</button>
        {' '}<button type="button" className="btn-tbl" onClick={() => { setReactivar(null); setMotivo(''); }}>Dejar en mantenimiento</button>
      </div>
    </form>}

    {pestana === 'reportes' && <>
      <div className="filter-pills" style={{ marginBottom: 10 }}>
        {(['todos', ...TIPOS_REPORTE] as const).map((estado) => (
          <button key={estado} className={`pill ${estadoReporte === estado ? 'active' : ''}`} onClick={() => { setEstadoReporte(estado); setPage(1); }}>{estado}</button>
        ))}
      </div>
      {!reportes ? <p className="empty">Cargando...</p> : reportes.resultados.length === 0 ? <p className="empty">No hay reportes en este estado.</p> : <>
        <Table headers={['Estacion', 'Usuario', 'Reporte', 'Fecha', 'Estado', 'Acciones']}>
          {reportes.resultados.map((r) => (
            <tr key={r.id}>
              <td>{r.estacion_nombre}<br /><small>{r.estacion_ocm_id}</small></td>
              <td>{r.usuario_nombre}</td>
              <td><strong>{r.tipo}</strong><br /><small>{r.descripcion || 'Sin comentario'}</small></td>
              <td>{fecha(r.fecha)}</td>
              <td><span className={`status-badge ${estadoClase(r.estado)}`}>{r.estado}</span></td>
              <td>
                {/* El backend solo permite atender un reporte mientras esta `abierto`; no hay reapertura. */}
                {puedeOperar && r.estado === 'abierto' && <>
                  <button className="btn-tbl" onClick={() => void ejecutar(() => cambiarEstadoReporte(r.id, 'resuelto'), 'Reporte resuelto.')}>Resolver</button>
                  <button className="btn-tbl" onClick={() => void ejecutar(() => cambiarEstadoReporte(r.id, 'descartado'), 'Reporte descartado.')}>Descartar</button>
                  <button className="btn-tbl primary" onClick={() => void ejecutar(() => reporteAIncidente(r.id), 'Incidente creado desde el reporte.')}>Abrir incidente</button>
                </>}
              </td>
            </tr>
          ))}
        </Table>
        {paginacion(reportes.total)}
      </>}
    </>}

    {pestana === 'incidentes' && <>
      {puedeOperar && <form className="admin-form-grid" onSubmit={crearIncidenteDesdeFormulario}>
        <div><label>Estacion</label><select value={nuevo.estacion_id} onChange={(e) => setNuevo({ ...nuevo, estacion_id: e.target.value, cargador_id: '' })}>
          <option value="">Selecciona</option>
          {estaciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select></div>
        <div><label>Cargador (opcional)</label><select value={nuevo.cargador_id} onChange={(e) => setNuevo({ ...nuevo, cargador_id: e.target.value })}>
          <option value="">Toda la estacion</option>
          {(estacionSeleccionada?.cargadores || []).map((c) => <option key={c.id} value={c.id}>#{c.numero} {c.tipo_conector}</option>)}
        </select></div>
        <div><label>Tipo</label><select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>{TIPOS_INCIDENTE.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label>Prioridad</label><select value={nuevo.prioridad} onChange={(e) => setNuevo({ ...nuevo, prioridad: e.target.value as PrioridadIncidente })}><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select></div>
        <div className="full-width"><label>Titulo</label><input value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} placeholder="No carga con CCS" required /></div>
        <div className="full-width"><label>Descripcion</label><textarea rows={2} value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} /></div>
        <div className="full-width"><label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={nuevo.bloquea_estacion} onChange={(e) => setNuevo({ ...nuevo, bloquea_estacion: e.target.checked })} style={{ width: 'auto' }} />Bloquea la estacion (la pasa a mantenimiento)</label></div>
        <div className="full-width station-form-actions"><button type="submit" className="btn-save-estacion">Abrir incidente</button></div>
      </form>}

      {cierre && <form className="section-box" onSubmit={cerrarIncidente}>
        <div className="box-title">Solucion del incidente · {cierre.nombre}</div>
        <textarea rows={2} value={solucion} onChange={(e) => setSolucion(e.target.value)} placeholder="Que se hizo para resolverlo" />
        <div className="station-form-actions">
          <button type="submit" className="btn-save-estacion" disabled={!solucion.trim()}>{cierre.destino === 'resuelto' ? 'Marcar como resuelto' : 'Cerrar incidente'}</button>
          <button type="button" className="btn-tbl" onClick={() => setCierre(null)}>Cancelar</button>
        </div>
      </form>}

      {!incidentes ? <p className="empty">Cargando...</p> : incidentes.resultados.length === 0 ? <p className="empty">No hay incidentes registrados.</p> : <>
        <Table headers={['Estacion / cargador', 'Incidente', 'Prioridad', 'Estado', 'Inicio', 'Acciones']}>
          {incidentes.resultados.map((i) => (
            <tr key={i.id}>
              <td>{i.estacion_nombre}<br /><small>{i.cargador_numero ? `Cargador #${i.cargador_numero}` : 'Toda la estacion'}</small></td>
              <td><strong>{i.titulo}</strong><br /><small>{i.tipo}{i.descripcion ? ` - ${i.descripcion}` : ''}{i.solucion ? ` · Solucion: ${i.solucion}` : ''}</small></td>
              <td>{i.prioridad}{i.bloquea_estacion && <><br /><small>bloquea estacion</small></>}</td>
              <td><span className={`status-badge ${estadoClase(i.estado)}`}>{i.estado}</span></td>
              <td>{fecha(i.fecha_inicio)}<br />{i.fecha_fin && <small>Fin: {fecha(i.fecha_fin)}</small>}</td>
              <td>
                {puedeOperar && TRANSICIONES[i.estado].map((destino) => (
                  destino === 'en_progreso'
                    ? <button key={destino} className="btn-tbl" onClick={() => void ejecutar(() => cambiarEstadoIncidente(i.id, destino), 'Incidente atendido.')}>Atender</button>
                    : <button key={destino} className={`btn-tbl ${destino === 'cerrado' ? 'danger' : ''}`} onClick={() => { setCierre({ id: i.id, destino, nombre: i.estacion_nombre }); setSolucion(i.solucion || ''); }}>
                      {destino === 'resuelto' ? 'Resolver' : 'Cerrar'}
                    </button>
                ))}
              </td>
            </tr>
          ))}
        </Table>
        {paginacion(incidentes.total)}
      </>}
    </>}
  </>;
}
