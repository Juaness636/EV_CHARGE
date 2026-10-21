// Fase 3: bitácora append-only (RN-E05). Aquí solo se consulta; no hay edición ni borrado.
import { useEffect, useState } from 'react';
import { Table } from '../../components/Table';
import { EmpresaLayout } from '../../layouts/EmpresaLayout';
import {
  listarEstaciones,
  listarHistorial,
  type AccionHistorial,
  type EstacionEmpresa,
  type Paginado,
  type HistorialRegistro,
} from '../../api/empresa.api';
import { fecha } from './comunes';

const ACCIONES: AccionHistorial[] = ['crear', 'editar', 'agregar_cargador', 'quitar_cargador', 'cambiar_estado', 'abrir_incidente', 'cerrar_incidente', 'eliminar'];
const TAMANO_PAGINA = 20;

export function EmpresaHistorialPage() {
  return (
    <EmpresaLayout titulo="Historial">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const [estaciones, setEstaciones] = useState<EstacionEmpresa[]>([]);
  const [datos, setDatos] = useState<Paginado<HistorialRegistro> | null>(null);
  const [filtros, setFiltros] = useState({ estacion_id: '', accion: '' as '' | AccionHistorial, desde: '', hasta: '' });
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => { void listarEstaciones().then(setEstaciones).catch(() => {}); }, []);

  useEffect(() => {
    setError('');
    listarHistorial({
      estacion_id: filtros.estacion_id || undefined,
      accion: filtros.accion || undefined,
      desde: filtros.desde || undefined,
      hasta: filtros.hasta || undefined,
      page,
      limit: TAMANO_PAGINA,
    }).then(setDatos).catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudo cargar el historial.'));
  }, [filtros, page]);

  return <>
    <div className="panel-toolbar">
      <select value={filtros.estacion_id} onChange={(e) => { setFiltros({ ...filtros, estacion_id: e.target.value }); setPage(1); }}>
        <option value="">Todas las estaciones</option>
        {estaciones.map((estacion) => <option key={estacion.id} value={estacion.id}>{estacion.nombre}</option>)}
      </select>
      <select value={filtros.accion} onChange={(e) => { setFiltros({ ...filtros, accion: e.target.value as '' | AccionHistorial }); setPage(1); }}>
        <option value="">Todas las acciones</option>
        {ACCIONES.map((accion) => <option key={accion} value={accion}>{accion}</option>)}
      </select>
      <input type="date" value={filtros.desde} onChange={(e) => { setFiltros({ ...filtros, desde: e.target.value }); setPage(1); }} aria-label="Desde" />
      <input type="date" value={filtros.hasta} onChange={(e) => { setFiltros({ ...filtros, hasta: e.target.value }); setPage(1); }} aria-label="Hasta" />
      <button className="btn-tbl" onClick={() => { setFiltros({ estacion_id: '', accion: '', desde: '', hasta: '' }); setPage(1); }}>Limpiar</button>
    </div>

    {error && <div className="alert alert-error">{error}</div>}

    {!datos ? <p className="empty">Cargando...</p> : datos.resultados.length === 0 ? <p className="empty">No hay movimientos con estos filtros.</p> : <>
      <Table headers={['Fecha', 'Estacion', 'Accion', 'Motivo', 'Autor']}>
        {datos.resultados.map((registro) => (
          <tr key={registro.id}>
            <td>{fecha(registro.fecha)}</td>
            <td>{registro.estacion_nombre}<br /><small>{registro.direccion || 'Sin direccion'}</small></td>
            <td><span className={`status-badge ${registro.accion === 'eliminar' ? 'status-inactive' : 'status-default'}`}>{registro.accion}</span></td>
            <td>{registro.motivo || 'Sin motivo'}</td>
            <td>{registro.usuario_nombre}</td>
          </tr>
        ))}
      </Table>
      <div className="panel-toolbar" style={{ marginTop: 10 }}>
        <button className="btn-tbl" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>Pagina {page} de {Math.max(1, Math.ceil(datos.total / TAMANO_PAGINA))} · {datos.total} registro(s)</span>
        <button className="btn-tbl" disabled={page * TAMANO_PAGINA >= datos.total} onClick={() => setPage(page + 1)}>Siguiente</button>
      </div>
    </>}
  </>;
}
