// Reseñas de las estaciones de la empresa. Se muestra el nombre del usuario,
// nunca su correo.
import { useEffect, useState } from 'react';
import { Table } from '../../components/Table';
import { EmpresaLayout } from '../../layouts/EmpresaLayout';
import { listarEstaciones, listarResenas, type ResenasEmpresa } from '../../api/empresa.api';
import { fecha } from './comunes';

const TAMANO_PAGINA = 10;

export function EmpresaResenasPage() {
  return (
    <EmpresaLayout titulo="Resenas">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const [datos, setDatos] = useState<ResenasEmpresa | null>(null);
  const [estaciones, setEstaciones] = useState<Array<{ id: string; nombre: string }>>([]);
  const [estacionId, setEstacionId] = useState('');
  const [puntaje, setPuntaje] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    void listarEstaciones()
      .then((lista) => setEstaciones(lista.map((e) => ({ id: e.id, nombre: e.nombre }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setError('');
    listarResenas({
      estacion_id: estacionId || undefined,
      puntaje: puntaje ? Number(puntaje) : undefined,
      page,
      limit: TAMANO_PAGINA,
    }).then(setDatos).catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las resenas.'));
  }, [estacionId, puntaje, page]);

  const estrellas = (valor: number) => <span className="rating-stars">{'*'.repeat(valor)}<span>{'*'.repeat(5 - valor)}</span></span>;
  const maximo = Math.max(1, ...Object.values(datos?.distribucion || {}).map(Number));

  return <>
    {error && <div className="alert alert-error">{error}</div>}

    {datos && <div className="kpi-grid">
      <div className="kpi-card"><div className="kpi-label">Promedio</div><div className="kpi-num">{datos.promedio === null ? 'Sin resenas' : `${datos.promedio}/5`}</div></div>
      <div className="kpi-card"><div className="kpi-label">Resenas del filtro</div><div className="kpi-num">{datos.total}</div></div>
      <div className="kpi-card"><div className="kpi-label">Historico total</div><div className="kpi-num">{datos.total_general}</div></div>
    </div>}

    {datos && Object.keys(datos.distribucion).length > 0 && (
      <div className="section-box" style={{ marginTop: 14 }}>
        <div className="box-title">Distribucion por estrellas</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {[5, 4, 3, 2, 1].map((valor) => {
            const conteo = datos.distribucion[String(valor)] ?? 0;
            return (
              <div key={valor} style={{ display: 'grid', gridTemplateColumns: '70px 1fr 40px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <span>{valor} estrellas</span>
                <span style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(conteo / maximo) * 100}%`, background: '#f1c40f' }} />
                </span>
                <span>{conteo}</span>
              </div>
            );
          })}
        </div>
      </div>
    )}

    <div className="panel-toolbar" style={{ marginTop: 14 }}>
      <select value={estacionId} onChange={(e) => { setEstacionId(e.target.value); setPage(1); }}>
        <option value="">Todas las estaciones</option>
        {estaciones.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
      </select>
      <select value={puntaje} onChange={(e) => { setPuntaje(e.target.value); setPage(1); }}>
        <option value="">Cualquier puntaje</option>
        {[5, 4, 3, 2, 1].map((valor) => <option key={valor} value={valor}>{valor} estrellas</option>)}
      </select>
    </div>

    {!datos ? <p className="empty">Cargando...</p> : datos.resultados.length === 0 ? <p className="empty">No hay resenas con estos filtros.</p> : <>
      <Table headers={['Estacion', 'Usuario', 'Puntaje', 'Comentario', 'Fecha']}>
        {datos.resultados.map((resena) => (
          <tr key={resena.id}>
            <td>{resena.estacion_nombre}</td>
            <td>{resena.usuario_nombre}</td>
            <td>{estrellas(resena.puntaje)} {resena.puntaje}/5</td>
            <td>{resena.comentario || 'Sin comentario'}</td>
            <td>{fecha(resena.fecha)}</td>
          </tr>
        ))}
      </Table>
      <div className="panel-toolbar" style={{ marginTop: 10 }}>
        <button className="btn-tbl" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>Pagina {page} de {Math.max(1, Math.ceil(datos.total / TAMANO_PAGINA))} · {datos.total} resena(s)</span>
        <button className="btn-tbl" disabled={page * TAMANO_PAGINA >= datos.total} onClick={() => setPage(page + 1)}>Siguiente</button>
      </div>
    </>}
  </>;
}
