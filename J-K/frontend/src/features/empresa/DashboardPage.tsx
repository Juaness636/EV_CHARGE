// Pantalla única de la empresa. Todo sale de `GET /empresa/dashboard`
// (agregador) salvo la serie, que se pide aparte porque es el único dato gráfico.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Table } from '../../components/Table';
import { EmpresaLayout, useEmpresa } from '../../layouts/EmpresaLayout';
import { obtenerDashboard, obtenerSerie, type DashboardEmpresa, type SerieTemporal } from '../../api/empresa.api';
import { marcarNotificacionesLeidas } from '../../api/notificaciones.api';
import { dinero, fecha, periodo } from './comunes';

export function EmpresaDashboardPage() {
  return (
    <EmpresaLayout titulo="Dashboard">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const { puedeOperar, refrescar } = useEmpresa();
  const [datos, setDatos] = useState<DashboardEmpresa | null>(null);
  const [serie, setSerie] = useState<SerieTemporal | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const hasta = new Date().toISOString().slice(0, 10);
      const desde = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [panel, linea] = await Promise.all([
        obtenerDashboard(),
        obtenerSerie({ granularidad: 'dia', desde, hasta }).catch(() => null),
      ]);
      setDatos(panel);
      setSerie(linea);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el dashboard.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void cargar(); }, []);

  if (cargando) return <p className="empty">Cargando...</p>;
  if (error || !datos) return <div className="alert alert-error">{error || 'Sin datos de la empresa.'}</div>;

  const k = datos.kpis;
  const cards = [
    ['Estaciones activas', `${k.estaciones_activas} de ${k.total_estaciones}`],
    ['En mantenimiento', k.estaciones_mantenimiento],
    ['Cargadores disponibles', `${k.cargadores_disponibles} de ${k.total_cargadores}`],
    ['Cargas del mes', k.cargas_mes],
    ['kWh del mes', k.kwh_mes],
    ['Ingresos estimados del mes', dinero(k.ingresos_mes)],
    ['Reservas proximas', k.reservas_proximas],
    ['Calificacion promedio', k.calificacion_promedio === null ? 'Sin resenas' : `${k.calificacion_promedio}/5 (${k.total_resenas})`],
  ];

  const maximo = Math.max(1, ...(serie?.puntos || []).map((p) => p.cargas));

  return <>
    <div className="kpi-grid">
      {cards.map(([label, valor]) => (
        <div className="kpi-card" key={String(label)}>
          <div className="kpi-label">{label}</div>
          <div className="kpi-num">{String(valor)}</div>
        </div>
      ))}
    </div>

    {datos.alertas.length > 0 && (
      <div className="alert alert-error">
        <strong>Requiere atencion</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {datos.alertas.map((alerta) => (
            <li key={alerta.tipo}>
              <Link style={{ color: 'inherit', fontWeight: 600 }} to={alerta.tipo === 'empresa' ? '/empresa/perfil' : '/empresa/incidentes'}>{alerta.mensaje}</Link>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div className="section-row" style={{ alignItems: 'flex-start' }}>
      <div className="section-box" style={{ flex: 2 }}>
        <div className="box-title">Cargas por dia (ultimos 14 dias)</div>
        {!serie || serie.puntos.length === 0 ? (
          <p className="empty">Aun no hay cargas registradas en este periodo.</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {serie.puntos.map((punto) => (
              <div key={punto.periodo} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 130px', gap: 8, alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>{periodo(punto.periodo, serie.granularidad)}</span>
                <span style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(punto.cargas / maximo) * 100}%`, background: datos.empresa.color_hex }} />
                </span>
                <span>{punto.cargas} cargas · {punto.kwh} kWh</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-box">
        <div className="box-title">Estado operativo</div>
        <div className="res-row"><span className="res-nombre">Reportes sin atender</span><strong>{datos.reportes_pendientes}</strong></div>
        <div className="res-row"><span className="res-nombre">Incidentes abiertos</span><strong>{datos.incidentes_abiertos}</strong></div>
        <div className="res-row"><span className="res-nombre">Empresa</span><strong>{datos.empresa.estado}</strong></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Link className="btn-tbl primary" to="/empresa/incidentes">Atender reportes</Link>
          <Link className="btn-tbl" to="/empresa/estaciones">Gestionar estaciones</Link>
          <Link className="btn-tbl" to="/empresa/estadisticas">Reporte mensual</Link>
        </div>
      </div>
    </div>

    <div className="section-box" style={{ marginTop: 16 }}>
      <div className="box-title">Ultimas notificaciones</div>
      {datos.notificaciones.length === 0 ? (
        <p className="empty">No tienes notificaciones por el momento.</p>
      ) : (
        <>
          <Table headers={['Notificacion', 'Tipo', 'Fecha', 'Estado']}>
            {datos.notificaciones.map((n) => (
              <tr key={n.id}>
                <td><strong>{n.titulo}</strong><br /><small>{n.mensaje}</small></td>
                <td>{n.tipo}</td>
                <td>{fecha(n.created_at)}</td>
                <td>{n.leida ? 'Leida' : 'Nueva'}</td>
              </tr>
            ))}
          </Table>
          {puedeOperar && (
            <div style={{ marginTop: 10 }}>
              <button
                className="btn-tbl"
                onClick={() => void marcarNotificacionesLeidas().then(async () => { await refrescar(); await cargar(); })}
              >
                Marcar todas como leidas
              </button>
            </div>
          )}
        </>
      )}
    </div>
  </>;
}
