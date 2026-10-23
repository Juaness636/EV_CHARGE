// Reporte semanal del administrador (equivale a ReporteSemanalAdmin.tsx de la app móvil).
import { useEffect, useState } from 'react';
import '../../styles/reporte-semanal.css';
import { obtenerReporteSemanal, type DiaSemanal, type MetricaSemanal, type ReporteSemanal as Reporte } from '../../api/admin.api';

const SEMANAS_MAX_ATRAS = 52;
const PRINCIPALES = ['nuevos_usuarios', 'cargas', 'reservas', 'ingresos_totales'];

const ICONOS: Record<string, string> = {
  nuevos_usuarios: 'user-plus',
  cargas: 'bolt',
  cargas_validadas: 'circle-check',
  kwh: 'battery-three-quarters',
  reservas: 'calendar-check',
  reservas_canceladas: 'calendar-xmark',
  compras: 'cart-shopping',
  ingresos_totales: 'sack-dollar',
  ingresos_reservas: 'money-bill-wave',
  ingresos_compras: 'store',
  reportes: 'triangle-exclamation',
  incidentes: 'screwdriver-wrench',
  calificaciones: 'star-half-stroke',
  calificacion_promedio: 'star',
  nuevos_vehiculos: 'car',
  nuevas_empresas: 'building',
};

type SerieDia = 'cargas' | 'reservas' | 'nuevos_usuarios' | 'ingresos';
const SERIES: Array<[SerieDia, string]> = [['cargas', 'Cargas'], ['reservas', 'Reservas'], ['nuevos_usuarios', 'Usuarios'], ['ingresos', 'Ingresos']];

const pesos = (valor: number) => `$${Math.round(valor || 0).toLocaleString('es-CO')} COP`;

function formatear(valor: number, formato: MetricaSemanal['formato']) {
  if (formato === 'dinero') return pesos(valor);
  if (formato === 'kwh') return `${valor.toLocaleString('es-CO')} kWh`;
  if (formato === 'estrellas') return valor ? `${valor.toFixed(1)} ★` : '—';
  return String(valor);
}

function pesosCortos(valor: number) {
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (valor >= 1_000) return `$${Math.round(valor / 1_000)} k`;
  return `$${Math.round(valor)}`;
}

function Variacion({ m }: { m: MetricaSemanal }) {
  const pct = m.variacion_pct;
  const tono = pct === null || pct === 0 ? 'neutro' : (pct > 0) === m.positivo ? 'bueno' : 'malo';
  const texto = pct === null ? (m.actual && !m.anterior ? 'Nuevo' : 'Sin cambios') : pct === 0 ? 'Igual' : `${pct > 0 ? '+' : ''}${pct.toLocaleString('es-CO')}%`;
  const icono = pct === null || pct === 0 ? 'minus' : pct > 0 ? 'arrow-trend-up' : 'arrow-trend-down';
  return <span className={`rs-variacion rs-${tono}`}><i className={`fa-solid fa-${icono}`} /> {texto}</span>;
}

function Grafico({ dias }: { dias: DiaSemanal[] }) {
  const [serie, setSerie] = useState<SerieDia>('cargas');
  const maximo = Math.max(...dias.map((d) => d[serie]), 1);
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  return (
    <div className="rs-tarjeta">
      <div className="rs-cabecera">
        <h3>Movimiento por día</h3>
        <div className="rs-chips">
          {SERIES.map(([valor, texto]) => <button key={valor} className={serie === valor ? 'activo' : ''} onClick={() => setSerie(valor)}>{texto}</button>)}
        </div>
      </div>
      <div className="rs-grafico" role="img" aria-label={`Gráfico de ${serie} por día`}>
        {dias.map((d) => {
          const valor = d[serie];
          return (
            <div className={`rs-columna${d.fecha === hoyIso ? ' hoy' : ''}`} key={d.fecha}>
              <span className="rs-barra-valor">{serie === 'ingresos' ? pesosCortos(valor) : valor}</span>
              <div className="rs-barra-fondo">
                <div className={`rs-barra${valor ? '' : ' vacia'}`} style={{ height: `${Math.max((valor / maximo) * 100, valor ? 6 : 2)}%` }} />
              </div>
              <span className="rs-dia">{d.dia}</span>
              <span className="rs-fecha">{Number(d.fecha.slice(-2))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReporteSemanal() {
  const [semanasAtras, setSemanasAtras] = useState(0);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');
    obtenerReporteSemanal(semanasAtras)
      .then((datos) => { if (!cancelado) setReporte(datos); })
      .catch((causa) => { if (!cancelado) setError(causa instanceof Error ? causa.message : 'No se pudo cargar el reporte.'); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [semanasAtras]);

  const navegador = (
    <div className="rs-navegador">
      <button className="rs-boton" disabled={cargando || semanasAtras >= SEMANAS_MAX_ATRAS} onClick={() => setSemanasAtras((n) => n + 1)}>
        <i className="fa-solid fa-chevron-left" /> Anterior
      </button>
      <div className="rs-semana">
        <strong>{reporte ? `Semana del ${reporte.semana.etiqueta}` : 'Cargando…'}</strong>
        {reporte?.en_curso && <span className="rs-en-curso"><i className="fa-solid fa-clock" /> Semana en curso</span>}
      </div>
      <button className="rs-boton" disabled={cargando || semanasAtras === 0} onClick={() => setSemanasAtras((n) => Math.max(0, n - 1))}>
        Siguiente <i className="fa-solid fa-chevron-right" />
      </button>
    </div>
  );

  if (error) return <>{navegador}<div className="alert alert-error">{error}</div></>;
  if (!reporte) return <>{navegador}<p className="empty">Cargando...</p></>;

  const principales = PRINCIPALES.map((c) => reporte.metricas.find((m) => m.clave === c)).filter(Boolean) as MetricaSemanal[];
  const resto = reporte.metricas.filter((m) => !PRINCIPALES.includes(m.clave));
  const maxTop = Math.max(...reporte.top_estaciones.map((e) => e.cargas), 1);
  const p = reporte.pendientes;
  const pendientes: Array<[string, number, string]> = [
    ['Cargas por validar', p.cargas_por_validar, 'bolt'],
    ['Reportes abiertos', p.reportes_abiertos, 'triangle-exclamation'],
    ['Incidentes abiertos', p.incidentes_abiertos, 'screwdriver-wrench'],
    ['Empresas por aprobar', p.empresas_pendientes, 'building'],
  ];

  return (
    <div className={`reporte-semanal${cargando ? ' cargando' : ''}`}>
      {navegador}
      <p className="rs-nota">
        {reporte.comparacion === 'mismo_tramo'
          ? `Comparado con el mismo tramo de la semana del ${reporte.semana_anterior.etiqueta} (hora de Colombia).`
          : `Comparado con la semana del ${reporte.semana_anterior.etiqueta} (hora de Colombia).`}
      </p>

      {reporte.destacados.length > 0 && (
        <div className="rs-tarjeta rs-destacados">
          <h3><i className="fa-solid fa-wand-magic-sparkles" /> Lo más importante</h3>
          <ul>{reporte.destacados.map((frase) => <li key={frase}>{frase}</li>)}</ul>
        </div>
      )}

      <div className="rs-principales">
        {principales.map((m) => (
          <div className="rs-metrica" key={m.clave}>
            <div className="rs-metrica-top">
              <span className="rs-icono"><i className={`fa-solid fa-${ICONOS[m.clave] ?? 'chart-simple'}`} /></span>
              <Variacion m={m} />
            </div>
            <div className="rs-valor">{formatear(m.actual, m.formato)}</div>
            <div className="rs-etiqueta">{m.etiqueta}</div>
            <div className="rs-anterior">Semana anterior: {formatear(m.anterior, m.formato)}</div>
          </div>
        ))}
      </div>

      <Grafico dias={reporte.por_dia} />

      <div className="rs-dos-columnas">
        <div className="rs-tarjeta">
          <h3>Todas las métricas</h3>
          <table className="rs-tabla">
            <thead><tr><th>Métrica</th><th>Anterior</th><th>Esta semana</th><th>Cambio</th></tr></thead>
            <tbody>
              {resto.map((m) => (
                <tr key={m.clave}>
                  <td><i className={`fa-solid fa-${ICONOS[m.clave] ?? 'chart-simple'}`} /> {m.etiqueta}</td>
                  <td>{formatear(m.anterior, m.formato)}</td>
                  <td><strong>{formatear(m.actual, m.formato)}</strong></td>
                  <td><Variacion m={m} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rs-columna-lateral">
          <div className="rs-tarjeta">
            <h3>Estaciones más usadas</h3>
            {reporte.top_estaciones.length === 0 ? <p className="rs-nota">No hubo cargas registradas esta semana.</p> : (
              <ol className="rs-top">
                {reporte.top_estaciones.map((e) => (
                  <li key={e.estacion_id}>
                    <div className="rs-top-fila"><strong>{e.estacion_nombre}</strong><span>{e.cargas} cargas · {e.kwh.toLocaleString('es-CO')} kWh</span></div>
                    <div className="rs-progreso"><div style={{ width: `${(e.cargas / maxTop) * 100}%` }} /></div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rs-tarjeta">
            <h3>Pendientes hoy</h3>
            <div className="rs-pendientes">
              {pendientes.map(([texto, valor, icono]) => (
                <div className={`rs-pendiente${valor ? ' alerta' : ''}`} key={texto}>
                  <i className={`fa-solid fa-${icono}`} />
                  <strong>{valor}</strong>
                  <span>{texto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
