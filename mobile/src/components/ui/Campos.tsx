// Campos de formulario multiplataforma. Reemplazan <input>, <select>, <input type="range">
// y <input type="datetime-local"> del web con controles que funcionan igual en Android, iOS y Web.
import React, { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/spacing';
import { etiquetaDia, hora as formatoHora } from '../../utils/formato';
import { Icono } from './Icono';
import { AppModal } from './Contenedores';

export function Etiqueta({ texto, requerido }: { texto: string; requerido?: boolean }) {
  const s = useThemedStyles(crearEstilos);
  return (
    <Text style={s.etiqueta}>
      {texto}
      {requerido && <Text style={s.asterisco}> *</Text>}
    </Text>
  );
}

interface CampoTextoProps extends Omit<TextInputProps, 'style'> {
  etiqueta?: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  password?: boolean;
  icono?: string;
}

export function CampoTexto({ etiqueta, requerido, error, ayuda, password, icono, multiline, editable = true, ...props }: CampoTextoProps) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={s.campo}>
      {etiqueta && <Etiqueta texto={etiqueta} requerido={requerido} />}
      <View style={[s.inputCaja, error ? s.inputError : null, !editable && s.inputDeshabilitado]}>
        {icono && <Icono name={icono} size={14} color={colors.textDim} />}
        <TextInput
          {...props}
          editable={editable}
          multiline={multiline}
          secureTextEntry={password && !visible}
          placeholderTextColor={colors.textDim}
          style={[s.input, multiline && s.inputMultilinea]}
          textAlignVertical={multiline ? 'top' : 'center'}
          accessibilityLabel={props.accessibilityLabel ?? etiqueta}
        />
        {password && (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            <Icono name={visible ? 'eye-slash' : 'eye'} size={16} color={colors.textDim} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : ayuda ? <Text style={s.ayuda}>{ayuda}</Text> : null}
    </View>
  );
}

export interface OpcionSelect {
  valor: string;
  etiqueta: string;
  descripcion?: string;
  deshabilitada?: boolean;
}

interface CampoSelectProps {
  etiqueta?: string;
  valor: string;
  opciones: OpcionSelect[];
  onChange: (valor: string) => void;
  placeholder?: string;
  buscable?: boolean;
  deshabilitado?: boolean;
  requerido?: boolean;
  ayuda?: string;
}

// Selector en modal con búsqueda opcional (útil para la lista nacional de estaciones).
export function CampoSelect({ etiqueta, valor, opciones, onChange, placeholder = 'Selecciona una opción', buscable, deshabilitado, requerido, ayuda }: CampoSelectProps) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const seleccionada = opciones.find((opcion) => opcion.valor === valor);
  const conBusqueda = buscable ?? opciones.length > 8;

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return opciones;
    return opciones.filter((opcion) => `${opcion.etiqueta} ${opcion.descripcion ?? ''}`.toLowerCase().includes(texto));
  }, [busqueda, opciones]);

  return (
    <View style={s.campo}>
      {etiqueta && <Etiqueta texto={etiqueta} requerido={requerido} />}
      <Pressable
        onPress={() => !deshabilitado && setAbierto(true)}
        style={[s.inputCaja, s.select, deshabilitado && s.inputDeshabilitado]}
        accessibilityRole="button"
        accessibilityLabel={etiqueta ? `${etiqueta}: ${seleccionada?.etiqueta ?? placeholder}` : seleccionada?.etiqueta ?? placeholder}
      >
        <Text style={[s.selectTexto, !seleccionada && { color: colors.textDim }]} numberOfLines={1}>
          {seleccionada?.etiqueta ?? placeholder}
        </Text>
        <Icono name="chevron-down" size={12} color={colors.textDim} />
      </Pressable>
      {ayuda ? <Text style={s.ayuda}>{ayuda}</Text> : null}

      <AppModal visible={abierto} onClose={() => { setAbierto(false); setBusqueda(''); }} titulo={etiqueta ?? placeholder} sinScroll>
        {conBusqueda && (
          <View style={[s.inputCaja, { marginBottom: Spacing.sm }]}>
            <Icono name="magnifying-glass" size={14} color={colors.textDim} />
            <TextInput value={busqueda} onChangeText={setBusqueda} placeholder="Buscar..." placeholderTextColor={colors.textDim} style={s.input} autoFocus />
          </View>
        )}
        <FlatList
          data={filtradas}
          keyExtractor={(item) => item.valor}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          style={{ maxHeight: 420 }}
          ListEmptyComponent={<Text style={[s.ayuda, { textAlign: 'center', padding: Spacing.md }]}>Sin resultados</Text>}
          renderItem={({ item }) => {
            const activa = item.valor === valor;
            return (
              <Pressable
                disabled={item.deshabilitada}
                onPress={() => { onChange(item.valor); setAbierto(false); setBusqueda(''); }}
                style={({ pressed }) => [s.opcion, activa && s.opcionActiva, item.deshabilitada && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.opcionTexto, activa && { color: colors.primary }]}>{item.etiqueta}</Text>
                  {item.descripcion ? <Text style={s.ayuda}>{item.descripcion}</Text> : null}
                </View>
                {activa && <Icono name="check" size={14} color={colors.primary} />}
              </Pressable>
            );
          }}
        />
      </AppModal>
    </View>
  );
}

// Grupo de botones tipo "píldora" para filtros o selección única.
export function Chips<T extends string>({ opciones, valor, onChange }: { opciones: Array<{ valor: T; etiqueta: string; icono?: string }>; valor: T; onChange: (valor: T) => void }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {opciones.map((opcion) => {
        const activa = opcion.valor === valor;
        return (
          <Pressable key={opcion.valor} onPress={() => onChange(opcion.valor)} style={[s.chip, activa && s.chipActiva]} accessibilityRole="button" accessibilityState={{ selected: activa }}>
            {opcion.icono && <Icono name={opcion.icono} size={11} color={activa ? colors.primary : colors.textMuted} />}
            <Text style={[s.chipTexto, activa && { color: colors.primary }]}>{opcion.etiqueta}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Casilla({ marcada, onChange, children }: { marcada: boolean; onChange: (valor: boolean) => void; children: ReactNode }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(!marcada)} style={s.casillaFila} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }}>
      <View style={[s.casilla, marcada && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {marcada && <Icono name="check" size={11} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text style={s.casillaTexto}>{children}</Text> : children}</View>
    </Pressable>
  );
}

// Equivalente al slider de duración (1 a 8 horas) del web.
export function SelectorDuracion({ valor, onChange, min = 1, max = 8 }: { valor: number; onChange: (valor: number) => void; min?: number; max?: number }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const valores = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View style={s.campo}>
      <Etiqueta texto={`Duración: ${valor} h`} />
      <View style={s.duracionFila}>
        {valores.map((h) => {
          const activa = h <= valor;
          return (
            <Pressable key={h} onPress={() => onChange(h)} style={[s.duracionPaso, activa && { backgroundColor: colors.primary, borderColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`${h} horas`}>
              <Text style={[s.duracionTexto, activa && { color: '#fff' }]}>{h}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Selector de fecha y hora de inicio: próximos 14 días + franjas de 30 minutos.
export function SelectorFechaHora({ valor, onChange, etiqueta = 'Inicio' }: { valor: Date; onChange: (fecha: Date) => void; etiqueta?: string }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState(() => new Date(valor));

  const dias = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const fecha = new Date();
    fecha.setHours(0, 0, 0, 0);
    fecha.setDate(fecha.getDate() + i);
    return fecha;
  }), [abierto]);

  const franjas = useMemo(() => {
    const ahora = Date.now();
    return Array.from({ length: 48 }, (_, i) => {
      const fecha = new Date(dia);
      fecha.setHours(Math.floor(i / 2), (i % 2) * 30, 0, 0);
      return fecha;
    }).filter((fecha) => fecha.getTime() > ahora);
  }, [dia]);

  return (
    <View style={s.campo}>
      <Etiqueta texto={etiqueta} />
      <Pressable onPress={() => { setDia(new Date(valor)); setAbierto(true); }} style={[s.inputCaja, s.select]} accessibilityRole="button">
        <Icono name="calendar-days" size={14} color={colors.textDim} />
        <Text style={s.selectTexto}>{etiquetaDia(valor)} · {formatoHora(valor)}</Text>
        <Icono name="chevron-down" size={12} color={colors.textDim} />
      </Pressable>
      <AppModal visible={abierto} onClose={() => setAbierto(false)} titulo="Selecciona fecha y hora">
        <Etiqueta texto="Día" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {dias.map((fecha) => {
            const activa = fecha.toDateString() === dia.toDateString();
            return (
              <Pressable key={fecha.toISOString()} onPress={() => setDia(fecha)} style={[s.chip, activa && s.chipActiva]}>
                <Text style={[s.chipTexto, activa && { color: colors.primary }]}>{etiquetaDia(fecha)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Etiqueta texto="Hora" />
        <View style={s.franjas}>
          {franjas.length === 0 && <Text style={s.ayuda}>No quedan horarios disponibles para este día.</Text>}
          {franjas.map((fecha) => {
            const activa = fecha.getTime() === valor.getTime();
            return (
              <Pressable key={fecha.toISOString()} onPress={() => { onChange(fecha); setAbierto(false); }} style={[s.franja, activa && s.chipActiva]}>
                <Text style={[s.chipTexto, activa && { color: colors.primary }]}>{formatoHora(fecha)}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppModal>
    </View>
  );
}

const crearEstilos = (c: Palette) => StyleSheet.create({
  campo: { gap: 6, marginBottom: Spacing.sm + 2, flexGrow: 1 },
  etiqueta: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
  asterisco: { color: c.error },
  inputCaja: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.input,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: Radius.md, paddingHorizontal: 12, minHeight: 46,
  },
  inputError: { borderColor: c.error },
  inputDeshabilitado: { opacity: 0.6 },
  input: { flex: 1, color: c.text, fontSize: 14.5, paddingVertical: 10, minWidth: 0, outlineStyle: 'none' } as never,
  inputMultilinea: { minHeight: 90 },
  error: { color: c.error, fontSize: 12 },
  ayuda: { color: c.textDim, fontSize: 12, lineHeight: 17 },
  select: { justifyContent: 'space-between' },
  selectTexto: { flex: 1, color: c.text, fontSize: 14.5 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: Radius.sm, borderBottomWidth: 1, borderBottomColor: c.border,
  },
  opcionActiva: { backgroundColor: c.primarySoft },
  opcionTexto: { color: c.text, fontSize: 14.5, fontWeight: '600' },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.cardElevated,
  },
  chipActiva: { borderColor: c.primary, backgroundColor: c.primarySoft },
  chipTexto: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
  casillaFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  casilla: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
  casillaTexto: { color: c.textMuted, fontSize: 13.5 },
  duracionFila: { flexDirection: 'row', gap: 6 },
  duracionPaso: {
    flex: 1, height: 38, borderRadius: Radius.sm, borderWidth: 1, borderColor: c.borderStrong,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardElevated,
  },
  duracionTexto: { color: c.textMuted, fontWeight: '800', fontSize: 13 },
  franjas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  franja: {
    width: 96, alignItems: 'center', paddingVertical: 9, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.cardElevated,
  },
});
