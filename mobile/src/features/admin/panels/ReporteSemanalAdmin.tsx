// Reporte semanal del administrador: métricas de la semana contra la anterior,
// movimiento por día, estaciones más usadas y pendientes por atender.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { obtenerReporteSemanal, type DiaSemanal, type MetricaSemanal } from '../../../api/admin.api';
import { useTheme, useThemedStyles } from '../../../theme/ThemeContext';
import type { Palette } from '../../../theme/colors';
import { Radius, Spacing } from '../../../theme/spacing';
import { pesos } from '../../../utils/formato';
import { useCarga } from '../../../utils/useCarga';
import { Alerta, Boton, Cargando, Chips, Icono, Insignia, Tarjeta } from '../../../components/ui';
import type { PropsAdmin } from './AdminPaneles';
import { EstadoError } from '../../../components/EstadoError';

const SEMANAS_MAX_ATRAS = 52;

// Métricas que van arriba en grande; el resto se lista debajo.
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

const SERIES: Array<{ valor: SerieDia; etiqueta: string; icono: string }> = [
  { valor: 'cargas', etiqueta: 'Cargas', icono: 'bolt' },
  { valor: 'reservas', etiqueta: 'Reservas', icono: 'calendar-check' },
  { valor: 'nuevos_usuarios', etiqueta: 'Usuarios', icono: 'user-plus' },
  { valor: 'ingresos', etiqueta: 'Ingresos', icono: 'sack-dollar' },
];

// En tarjetas y filas no cabe el sufijo "COP"; la sección ya deja claro que es en pesos.
function formatear(valor: number, formato: MetricaSemanal['formato']): string {
  if (formato === 'dinero') return pesos(valor).replace(' COP', '');
  if (formato === 'kwh') return `${valor.toLocaleString('es-CO')} kWh`;
  if (formato === 'estrellas') return valor ? `${valor.toFixed(1)} ★` : '—';
  return String(valor);
}

// Pesos abreviados para las barras del gráfico ($1,2 M, $350 k).
function pesosCortos(valor: number): string {
  if (valor >= 1_000_000) return `$${(valor / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (valor >= 1_000) return `$${Math.round(valor / 1_000)} k`;
  return `$${Math.round(valor)}`;
}

function useTonoVariacion() {
  const { colors } = useTheme();
  return (m: MetricaSemanal) => {
    if (m.variacion_pct === null || m.variacion_pct === 0) return colors.textDim;
    const mejora = m.variacion_pct > 0 === m.positivo;
    return mejora ? colors.primary : colors.error;
  };
}

function Variacion({ metrica }: { metrica: MetricaSemanal }) {
  const s = useThemedStyles(crearEstilos);
  const tono = useTonoVariacion()(metrica);
  const { variacion_pct: pct } = metrica;
  const texto = pct === null
    ? (metrica.actual && !metrica.anterior ? 'Nuevo' : 'Sin cambios')
    : pct === 0 ? 'Igual' : `${pct > 0 ? '+' : ''}${pct.toLocaleString('es-CO')}%`;
  const icono = pct === null || pct === 0 ? 'minus' : pct > 0 ? 'arrow-trend-up' : 'arrow-trend-down';
  return (
    <View style={[s.variacion, { backgroundColor: tono + '1f' }]}>
      <Icono name={icono} size={10} color={tono} />
      <Text style={[s.variacionTexto, { color: tono }]}>{texto}</Text>
    </View>
  );
}

function TarjetaMetrica({ metrica }: { metrica: MetricaSemanal }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  return (
    <View style={s.metrica}>
      <View style={s.filaEntre}>
        <View style={s.metricaIcono}>
          <Icono name={ICONOS[metrica.clave] ?? 'chart-simple'} size={14} color={colors.primary} />
        </View>
        <Variacion metrica={metrica} />
      </View>
      <Text style={[s.metricaValor, metrica.formato === 'dinero' && { fontSize: 22 }]} numberOfLines={1} adjustsFontSizeToFit>{formatear(metrica.actual, metrica.formato)}</Text>
      <Text style={s.metricaEtiqueta}>{metrica.etiqueta}</Text>
      <Text style={s.textoSuave}>Semana anterior: {formatear(metrica.anterior, metrica.formato)}</Text>
    </View>
  );
}

function FilaMetrica({ metrica }: { metrica: MetricaSemanal }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  return (
    <View style={s.fila}>
      <Icono name={ICONOS[metrica.clave] ?? 'chart-simple'} size={13} color={colors.textDim} style={{ width: 18 }} />
      <Text style={[s.texto, { flex: 1 }]} numberOfLines={1}>{metrica.etiqueta}</Text>
      <Text style={s.textoSuave}>{formatear(metrica.anterior, metrica.formato)} →</Text>
      <Text style={[s.texto, { fontWeight: '800' }]}>{formatear(metrica.actual, metrica.formato)}</Text>
      <Variacion metrica={metrica} />
    </View>
  );
}

function GraficoDias({ dias }: { dias: DiaSemanal[] }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const [serie, setSerie] = useState<SerieDia>('cargas');
  const valores = dias.map((d) => d[serie]);
  const maximo = Math.max(...valores, 1);
  const hoy = new Date();
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  return (
    <Tarjeta style={{ gap: Spacing.sm }}>
      <Text style={s.titulo}>Movimiento por día</Text>
      <Chips opciones={SERIES} valor={serie} onChange={setSerie} />
      <View style={s.grafico} accessibilityLabel={`Gráfico de ${serie} por día`}>
        {dias.map((d) => {
          const valor = d[serie];
          const alto = Math.max((valor / maximo) * 100, valor ? 6 : 2);
          const esHoy = d.fecha === hoyIso;
          return (
            <View key={d.fecha} style={s.columna}>
              <Text style={s.barraValor} numberOfLines={1}>{serie === 'ingresos' ? pesosCortos(valor) : valor}</Text>
              <View style={s.barraFondo}>
                <View style={[s.barra, { height: `${alto}%`, backgroundColor: valor ? colors.primary : colors.borderStrong, opacity: esHoy || !valor ? 1 : 0.8 }]} />
              </View>
              <Text style={[s.barraDia, esHoy && { color: colors.primary, fontWeight: '800' }]}>{d.dia}</Text>
              <Text style={s.barraFecha}>{Number(d.fecha.slice(-2))}</Text>
            </View>
          );
        })}
      </View>
    </Tarjeta>
  );
}

export function ReporteSemanalAdmin({ version }: PropsAdmin) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const [semanasAtras, setSemanasAtras] = useState(0);
  const { datos: reporte, cargando, error, fallo, recargar } = useCarga(() => obtenerReporteSemanal(semanasAtras), null, [version, semanasAtras]);

  const navegador = (
    <View style={s.navegador}>
      <Boton titulo="Anterior" icono="chevron-left" pequeno variante="outline" disabled={semanasAtras >= SEMANAS_MAX_ATRAS || cargando} onPress={() => setSemanasAtras((n) => n + 1)} />
      <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
        <Text style={s.semanaTitulo} numberOfLines={2}>{reporte ? reporte.semana.etiqueta : 'Cargando…'}</Text>
        {reporte?.en_curso ? <Insignia texto="Semana en curso" tono="verde" icono="clock" /> : null}
      </View>
      <Boton titulo="Siguiente" icono="chevron-right" iconoDerecha pequeno variante="outline" disabled={semanasAtras === 0 || cargando} onPress={() => setSemanasAtras((n) => Math.max(0, n - 1))} />
    </View>
  );

  if (error) return <>{navegador}<EstadoError error={fallo} onReintentar={recargar} compacto /></>;
  if (!reporte) return <>{navegador}<Cargando /></>;

  const principales = PRINCIPALES.map((c) => reporte.metricas.find((m) => m.clave === c)).filter(Boolean) as MetricaSemanal[];
  const resto = reporte.metricas.filter((m) => !PRINCIPALES.includes(m.clave));
  const maxTop = Math.max(...reporte.top_estaciones.map((e) => e.cargas), 1);
  const p = reporte.pendientes;
  const pendientes = [
    { texto: 'Cargas por validar', valor: p.cargas_por_validar, icono: 'bolt' },
    { texto: 'Reportes abiertos', valor: p.reportes_abiertos, icono: 'triangle-exclamation' },
    { texto: 'Incidentes abiertos', valor: p.incidentes_abiertos, icono: 'screwdriver-wrench' },
    { texto: 'Empresas por aprobar', valor: p.empresas_pendientes, icono: 'building' },
  ];

  return (
    <View style={{ gap: Spacing.md, opacity: cargando ? 0.6 : 1 }}>
      {navegador}
      <Text style={[s.textoSuave, { textAlign: 'center' }]}>
        {reporte.comparacion === 'mismo_tramo'
          ? `Comparado con el mismo tramo de la semana del ${reporte.semana_anterior.etiqueta} (hora de Colombia).`
          : `Comparado con la semana del ${reporte.semana_anterior.etiqueta} (hora de Colombia).`}
      </Text>

      {reporte.destacados.length > 0 && (
        <Tarjeta style={[s.destacados, { borderColor: colors.primaryBorder }]}>
          <View style={s.fila}>
            <Icono name="wand-magic-sparkles" size={14} color={colors.primary} />
            <Text style={s.titulo}>Lo más importante</Text>
          </View>
          {reporte.destacados.map((frase) => (
            <Text key={frase} style={s.texto}>• {frase}</Text>
          ))}
        </Tarjeta>
      )}

      <View style={s.grid}>
        {principales.map((m) => <TarjetaMetrica key={m.clave} metrica={m} />)}
      </View>

      <GraficoDias dias={reporte.por_dia} />

      <Tarjeta style={{ gap: 10 }}>
        <Text style={s.titulo}>Todas las métricas</Text>
        {resto.map((m) => <FilaMetrica key={m.clave} metrica={m} />)}
      </Tarjeta>

      <Tarjeta style={{ gap: 10 }}>
        <Text style={s.titulo}>Estaciones más usadas</Text>
        {reporte.top_estaciones.length === 0 ? (
          <Text style={s.textoSuave}>No hubo cargas registradas esta semana.</Text>
        ) : reporte.top_estaciones.map((e, i) => (
          <View key={e.estacion_id} style={{ gap: 4 }}>
            <View style={s.fila}>
              <Text style={[s.posicion, { color: i === 0 ? colors.primary : colors.textDim }]}>{i + 1}</Text>
              <Text style={[s.texto, { flex: 1, fontWeight: '700' }]} numberOfLines={1}>{e.estacion_nombre}</Text>
              <Text style={s.textoSuave}>{e.cargas} cargas · {e.kwh.toLocaleString('es-CO')} kWh</Text>
            </View>
            <View style={s.progresoFondo}>
              <View style={[s.progreso, { width: `${(e.cargas / maxTop) * 100}%` }]} />
            </View>
          </View>
        ))}
      </Tarjeta>

      <Tarjeta style={{ gap: 10 }}>
        <Text style={s.titulo}>Pendientes hoy</Text>
        <View style={s.grid}>
          {pendientes.map((x) => {
            const tono = x.valor ? colors.warning : colors.textDim;
            return (
              <View key={x.texto} style={[s.pendiente, { borderColor: tono + '55', backgroundColor: tono + '14' }]}>
                <Icono name={x.icono} size={13} color={tono} />
                <Text style={[s.pendienteValor, { color: x.valor ? colors.text : colors.textDim }]}>{x.valor}</Text>
                <Text style={s.textoSuave}>{x.texto}</Text>
              </View>
            );
          })}
        </View>
      </Tarjeta>
    </View>
  );
}

const crearEstilos = (c: Palette) => StyleSheet.create({
  titulo: { color: c.text, fontSize: 16, fontWeight: '800' },
  texto: { color: c.text, fontSize: 14, lineHeight: 20 },
  textoSuave: { color: c.textMuted, fontSize: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  navegador: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  semanaTitulo: { color: c.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  destacados: { gap: 6, backgroundColor: c.primarySoft },
  metrica: {
    flexGrow: 1, flexBasis: 150, backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: c.border, padding: Spacing.md, gap: 4,
  },
  metricaIcono: { width: 30, height: 30, borderRadius: Radius.full, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  metricaValor: { color: c.text, fontSize: 26, fontWeight: '900', marginTop: 6 },
  metricaEtiqueta: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
  variacion: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full },
  variacionTexto: { fontSize: 11.5, fontWeight: '800' },
  grafico: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 190, marginTop: Spacing.xs },
  columna: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barraFondo: { flex: 1, width: '100%', maxWidth: 38, justifyContent: 'flex-end' },
  barra: { width: '100%', borderTopLeftRadius: Radius.sm, borderTopRightRadius: Radius.sm },
  barraValor: { color: c.textMuted, fontSize: 10.5, fontWeight: '700' },
  barraDia: { color: c.textMuted, fontSize: 11.5, fontWeight: '600' },
  barraFecha: { color: c.textDim, fontSize: 10.5 },
  posicion: { width: 18, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  progresoFondo: { height: 6, borderRadius: Radius.full, backgroundColor: c.border, overflow: 'hidden', marginLeft: 26 },
  progreso: { height: '100%', borderRadius: Radius.full, backgroundColor: c.primary },
  pendiente: { flexGrow: 1, flexBasis: 140, borderRadius: Radius.md, borderWidth: 1, padding: Spacing.sm + 2, gap: 2 },
  pendienteValor: { fontSize: 22, fontWeight: '900' },
});
