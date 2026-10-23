// Resumen del mes: KPIs, alertas y últimas notificaciones de la empresa.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { obtenerDashboard, type DashboardEmpresa } from '../../api/empresa.api';
import {
  Aviso,
  Kpi,
  Tarjeta,
  Titulo,
  Vacio,
  dinero,
  fecha,
  mensajeError,
  useEstilos,
  useColores,
} from './componentes';

export const DashboardTab: React.FC = () => {
  const estilos = useEstilos();
  const colors = useColores();
  const [datos, setDatos] = useState<DashboardEmpresa | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    obtenerDashboard()
      .then(setDatos)
      .catch((e) => setError(mensajeError(e, 'No se pudo cargar el panel.')));
  }, []);

  if (error) return <Aviso tipo="error" texto={error} />;
  if (!datos) return <ActivityIndicator color={colors.primary} />;

  const { kpis } = datos;
  return (
    <View>
      <View style={estilos.kpiGrid}>
        <Kpi etiqueta="Estaciones activas" valor={`${kpis.estaciones_activas}/${kpis.total_estaciones}`} />
        <Kpi etiqueta="Cargadores disponibles" valor={`${kpis.cargadores_disponibles}/${kpis.total_cargadores}`} />
        <Kpi etiqueta="Cargas del mes" valor={kpis.cargas_mes} />
        <Kpi etiqueta="kWh del mes" valor={kpis.kwh_mes.toFixed(1)} />
        <Kpi etiqueta="Ingresos del mes" valor={dinero(kpis.ingresos_mes)} />
        <Kpi etiqueta="Reservas próximas" valor={kpis.reservas_proximas} />
        <Kpi
          etiqueta={`Calificación (${kpis.total_resenas})`}
          valor={kpis.calificacion_promedio != null ? `${kpis.calificacion_promedio.toFixed(1)} ★` : '—'}
        />
        <Kpi etiqueta="En mantenimiento" valor={kpis.estaciones_mantenimiento} />
      </View>

      <Tarjeta>
        <Titulo>Alertas</Titulo>
        <Text style={estilos.texto}>Reportes pendientes: {datos.reportes_pendientes}</Text>
        <Text style={estilos.texto}>Incidentes abiertos: {datos.incidentes_abiertos}</Text>
        {datos.alertas.map((a) => (
          <Text key={a.tipo} style={[estilos.texto, { color: colors.warning, marginTop: 4 }]}>• {a.mensaje}</Text>
        ))}
      </Tarjeta>

      <Tarjeta>
        <Titulo>Notificaciones recientes</Titulo>
        {datos.notificaciones.length === 0 ? (
          <Vacio texto="Sin notificaciones." />
        ) : (
          datos.notificaciones.map((n) => (
            <View key={n.id} style={{ marginBottom: 10 }}>
              <Text style={[estilos.texto, { fontWeight: n.leida ? '400' : '800' }]}>{n.titulo}</Text>
              <Text style={estilos.textoSuave}>{n.mensaje}</Text>
              <Text style={estilos.textoSuave}>{fecha(n.created_at)}</Text>
            </View>
          ))
        )}
      </Tarjeta>
    </View>
  );
};
