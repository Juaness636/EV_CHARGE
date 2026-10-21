// Fase 6 y 7: métricas por periodo, por estación, por cargador y reporte mensual imprimible.
import { useEffect, useState } from 'react';
import { Table } from '../../components/Table';
import { EmpresaLayout } from '../../layouts/EmpresaLayout';
import {
  descargarReporteMensual,
  estadisticasPorCargador,
  estadisticasPorEstacion,
  obtenerResumen,
  obtenerSerie,
  type CargoPorCargador,
  type EstadisticaPorEstacion,
  type ResumenEmpresa,
  type SerieTemporal,
} from '../../api/empresa.api';
import { dinero, fechaCorta, periodo } from './comunes';

const mesActual = () => new Date().toISOString().slice(0, 7);
// `DIAS_MAX_RANGO` del backend: un dia menos para que el cierre no supere el tope.
const RANGO_MAXIMO_DIAS = 729;

export function EmpresaEstadisticasPage() {
  return (
    <EmpresaLayout titulo="Estadisticas">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [granularidad, setGranularidad] = useState<'dia' | 'mes'>('dia');
  const [estacionId, setEstacionId] = useState('');
  const [resumen, setResumen] = useState<ResumenEmpresa | null>(null);
  const [porEstacion, setPorEstacion] = useState<EstadisticaPorEstacion[]>([]);
  const [porCargador, setPorCargador] = useState<CargoPorCargador | null>(null);
  const [serie, setSerie] = useState<SerieTemporal | null>(null);
  const [mes, setMes] = useState(mesActual());
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  const filtro = { desde: desde || undefined, hasta: hasta || undefined };

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const [r, e, c, s] = await Promise.all([
        obtenerResumen(filtro),
        estadisticasPorEstacion(filtro),
        estadisticasPorCargador({ ...filtro, estacion_id: estacionId || undefined }),
        obtenerSerie({ ...filtro, granularidad }),
      ]);
      setResumen(r);
      setPorEstacion(e);
      setPorCargador(c);
      setSerie(s);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las metricas.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void cargar(); }, [desde, hasta, granularidad, estacionId]);

  const descargar = async () => {
    setMensaje('');
    setError('');
    try {
      await descargarReporteMensual(mes);
      setMensaje(`Reporte de ${mes} descargado. Abre el archivo e imprímelo como PDF.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar el reporte.');
    }
  };

  if (cargando) return <p className="empty">Cargando...</p>;

  return <>
    <div className="panel-toolbar">
      <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
      <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
      <select value={granularidad} onChange={(e) => setGranularidad(e.target.value as 'dia' | 'mes')}>
        <option value="dia">Serie por dia</option>
        <option value="mes">Serie por mes</option>
      </select>
      <select value={estacionId} onChange={(e) => setEstacionId(e.target.value)}>
        <option value="">Todos los cargadores</option>
        {porEstacion.map((estacion) => <option key={estacion.estacion_id} value={estacion.estacion_id}>{estacion.nombre}</option>)}
      </select>
      {/* Sin fechas el backend toma los ultimos 30 dias; para ver todo el historial hay que
          pedir el rango maximo que acepta (`DIAS_MAX_RANGO = 730`). */}
      <button className="btn-tbl" onClick={() => {
        const hasta = new Date();
        const desde = new Date(hasta.getTime() - RANGO_MAXIMO_DIAS * 86_400_000);
        setDesde(desde.toISOString().slice(0, 10));
        setHasta(hasta.toISOString().slice(0, 10));
        setEstacionId('');
      }}>Todo el tiempo</button>
    </div>

    {error && <div className="alert alert-error">{error}</div>}
    {mensaje && <div className="alert alert-success">{mensaje}</div>}

    {resumen && <div className="kpi-grid">
      <div className="kpi-card"><div className="kpi-label">Periodo</div><div className="kpi-num" style={{ fontSize: 15 }}>{`${fechaCorta(resumen.desde)} - ${fechaCorta(resumen.hasta)}`}</div></div>
      <div className="kpi-card"><div className="kpi-label">Cargas</div><div className="kpi-num">{resumen.total_cargas}</div></div>
      <div className="kpi-card"><div className="kpi-label">kWh</div><div className="kpi-num">{resumen.total_kwh}</div></div>
      <div className="kpi-card"><div className="kpi-label">Ingresos estimados</div><div className="kpi-num" style={{ fontSize: 18 }}>{dinero(resumen.ingresos_estimados)}</div></div>
      <div className="kpi-card"><div className="kpi-label">Horas de carga</div><div className="kpi-num">{Math.round(resumen.duracion_total_min / 60)}</div></div>
      <div className="kpi-card"><div className="kpi-label">kWh promedio</div><div className="kpi-num">{resumen.promedio_kwh_por_carga}</div></div>
      <div className="kpi-card"><div className="kpi-label">Variacion de cargas</div><div className="kpi-num">{resumen.variacion_cargas_pct === null ? 'Sin anterior' : `${resumen.variacion_cargas_pct}%`}</div></div>
      <div className="kpi-card"><div className="kpi-label">Calificacion promedio</div><div className="kpi-num">{resumen.calificacion_promedio === null ? '-' : `${resumen.calificacion_promedio}/5`}</div></div>
    </div>}

    <div className="section-box" style={{ marginTop: 16 }}>
      <div className="box-title">Serie temporal ({serie?.granularidad || granularidad})</div>
      {!serie || serie.puntos.length === 0 ? <p className="empty">Sin cargas en este periodo.</p> : (
        <Table headers={['Periodo', 'Cargas', 'kWh', 'Ingresos estimados']}>
          {serie.puntos.map((punto) => (
            <tr key={punto.periodo}><td>{periodo(punto.periodo, serie.granularidad)}</td><td>{punto.cargas}</td><td>{punto.kwh}</td><td>{dinero(punto.ingresos)}</td></tr>
          ))}
        </Table>
      )}
    </div>

    <div className="section-box" style={{ marginTop: 16 }}>
      <div className="box-title">Por estacion</div>
      {porEstacion.length === 0 ? <p className="empty">No tienes estaciones.</p> : (
        <Table headers={['Estacion', 'Estado', 'Cargadores', 'Cargas', 'kWh', 'Ingresos', 'Reservas activas', 'Incidentes', 'Calificacion']}>
          {porEstacion.map((e) => (
            <tr key={e.estacion_id}>
              <td>{e.nombre}</td>
              <td>{e.estado}</td>
              <td>{e.total_cargadores}</td>
              <td>{e.cargas}</td>
              <td>{e.kwh}</td>
              <td>{dinero(e.ingresos)}</td>
              <td>{e.reservas_activas}</td>
              <td>{e.incidentes_abiertos}</td>
              <td>{e.calificacion_promedio === null ? '-' : `${e.calificacion_promedio}/5`}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>

    {porCargador && <div className="section-box" style={{ marginTop: 16 }}>
      <div className="box-title">Por cargador</div>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
        Criterio: {porCargador.criterio} · {porCargador.total_sesiones_con_cargador} sesion(es) con cargador identificado
        {porCargador.mas_usado && ` · Mas usado: ${porCargador.mas_usado.estacion_nombre} #${porCargador.mas_usado.numero} (${porCargador.mas_usado.sesiones} sesiones)`}
      </p>
      {porCargador.resultados.length === 0 ? <p className="empty">Sin sesiones con cargador en este periodo.</p> : (
        <Table headers={['Estacion', 'Cargador', 'Conector', 'Potencia', 'Estado', 'Sesiones', 'kWh', 'Minutos', 'Participacion']}>
          {porCargador.resultados.map((c) => (
            <tr key={c.cargador_id}>
              <td>{c.estacion_nombre}</td>
              <td>#{c.numero}</td>
              <td>{c.tipo_conector}</td>
              <td>{c.potencia_kw} kW</td>
              <td>{c.estado}</td>
              <td>{c.sesiones}</td>
              <td>{c.kwh}</td>
              <td>{c.duracion_min}</td>
              <td>{c.participacion_pct}%</td>
            </tr>
          ))}
        </Table>
      )}
    </div>}

    <div className="section-box" style={{ marginTop: 16 }}>
      <div className="box-title">Reporte mensual</div>
      <div className="panel-toolbar">
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes del reporte" />
        <button className="btn-save-estacion" onClick={() => void descargar()}>Descargar reporte</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Documento HTML listo para imprimir o guardar como PDF.</p>
    </div>
  </>;
}
