// Contenedores reutilizables: tarjetas, insignias, modales adaptativos, alertas y estados vacíos.
import React, { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text,
  useWindowDimensions, View, type StyleProp, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { BREAKPOINT_ESCRITORIO, Radius, Spacing } from '../../theme/spacing';
import { Icono } from './Icono';
import { useCapa } from '../capas';
import { CapaNotificaciones } from '../Notificaciones';
import { LogoCargando, TarjetaEsqueleto, usarNativo, useReducirMovimiento } from '../animacion';

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useThemedStyles(crearEstilos);
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

type TonoInsignia = 'verde' | 'azul' | 'amarillo' | 'rojo' | 'gris';

export function Insignia({ texto, tono = 'gris', icono }: { texto: string; tono?: TonoInsignia; icono?: string }) {
  const { colors } = useTheme();
  const mapa: Record<TonoInsignia, [string, string]> = {
    verde: [colors.primary, colors.primarySoft],
    azul: [colors.info, colors.infoSoft],
    amarillo: [colors.warning, colors.warningSoft],
    rojo: [colors.error, colors.errorSoft],
    gris: [colors.textDim, colors.modo === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'],
  };
  const [color, fondo] = mapa[tono];
  return (
    <View style={[estilosFijos.insignia, { backgroundColor: fondo, borderColor: color + '55' }]}>
      {icono && <Icono name={icono} size={10} color={color} />}
      <Text style={[estilosFijos.insigniaTexto, { color }]}>{texto}</Text>
    </View>
  );
}

// Tono de insignia según el estado devuelto por el backend.
export function tonoEstado(estado?: string): TonoInsignia {
  const valor = (estado || '').toLowerCase();
  if (['activa', 'activo', 'disponible', 'resuelto', 'validada', 'respondido', 'aprobada', 'realizada', 'entregado'].includes(valor)) return 'verde';
  if (['reservada', 'pendiente', 'confirmado', 'enviado', 'en_curso', 'ocupada'].includes(valor)) return 'azul';
  if (['mantenimiento', 'abierto'].includes(valor)) return 'amarillo';
  if (['inactiva', 'inactivo', 'cancelada', 'cancelado', 'rechazada', 'fuera_servicio'].includes(valor)) return 'rojo';
  return 'gris';
}

export function Alerta({ tipo = 'error', texto }: { tipo?: 'error' | 'success' | 'warning' | 'info'; texto: string }) {
  const { colors } = useTheme();
  const color = tipo === 'error' ? colors.error : tipo === 'warning' ? colors.warning : tipo === 'info' ? colors.info : colors.primary;
  const icono = tipo === 'error' ? 'circle-xmark' : tipo === 'warning' ? 'triangle-exclamation' : tipo === 'info' ? 'circle-info' : 'circle-check';
  return (
    <View accessibilityRole="alert" style={[estilosFijos.alerta, { borderColor: color + '66', backgroundColor: color + '1f' }]}>
      <Icono name={icono} size={14} color={color} />
      <Text style={[estilosFijos.alertaTexto, { color }]}>{texto}</Text>
    </View>
  );
}

export function Vacio({ texto, icono = 'inbox' }: { texto: string; icono?: string }) {
  const { colors } = useTheme();
  return (
    <View style={estilosFijos.vacio}>
      <Icono name={icono} size={26} color={colors.textDim} />
      <Text style={[estilosFijos.vacioTexto, { color: colors.textDim }]}>{texto}</Text>
    </View>
  );
}

// Estado de carga: tarjetas "fantasma" para listas o el logo animado con un texto.
export function Cargando({ texto, filas = 3 }: { texto?: string; filas?: number }) {
  const { colors } = useTheme();
  if (texto) {
    return (
      <View style={estilosFijos.vacio}>
        <LogoCargando tamano={44} />
        <Text style={[estilosFijos.vacioTexto, { color: colors.textDim }]}>{texto}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }} accessibilityLabel="Cargando información">
      {Array.from({ length: filas }, (_, i) => <TarjetaEsqueleto key={i} />)}
    </View>
  );
}

export function Estrellas({ valor, tamano = 14, onChange }: { valor: number; tamano?: number; onChange?: (valor: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={estilosFijos.estrellas} accessibilityLabel={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const estrella = <Icono name="star" size={tamano} color={i <= valor ? (colors.modo === 'light' ? '#b07d00' : '#f5b301') : colors.borderStrong} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i} estrellas`}>
            {estrella}
          </Pressable>
        ) : <View key={i}>{estrella}</View>;
      })}
    </View>
  );
}

export function KPI({ etiqueta, valor, icono }: { etiqueta: string; valor: string | number; icono?: string }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  return (
    <View style={s.kpi}>
      <View style={estilosFijos.kpiCabecera}>
        {icono && <Icono name={icono} size={13} color={colors.primary} />}
        <Text style={s.kpiEtiqueta}>{etiqueta}</Text>
      </View>
      <Text style={s.kpiValor} numberOfLines={1} adjustsFontSizeToFit>{String(valor)}</Text>
    </View>
  );
}

// Fila etiqueta / valor para listas de detalle.
export function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
      <Text style={{ color: colors.textDim }}>{etiqueta}: </Text>
      {valor}
    </Text>
  );
}

// Fila de lista para los paneles (reemplaza las tablas del web).
export function ItemLista({ titulo, children, acciones, insignia }: { titulo: string; children?: ReactNode; acciones?: ReactNode; insignia?: ReactNode }) {
  const s = useThemedStyles(crearEstilos);
  return (
    <View style={s.item}>
      <View style={s.itemCabecera}>
        <Text style={s.itemTitulo}>{titulo}</Text>
        {insignia}
      </View>
      {children ? <View style={{ gap: 3 }}>{children}</View> : null}
      {acciones ? <View style={s.itemAcciones}>{acciones}</View> : null}
    </View>
  );
}

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  titulo?: string;
  children: ReactNode;
  anchoMaximo?: number;
  pie?: ReactNode;
  sinScroll?: boolean;
}

// Modal adaptativo: hoja inferior en celulares y tarjeta centrada en PC/tablet.
export function AppModal({ visible, onClose, titulo, children, anchoMaximo = 480, pie, sinScroll = false }: ModalProps) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const escritorio = width >= BREAKPOINT_ESCRITORIO || (width >= 600 && width > height);
  const capa = useCapa(visible);
  const reducir = useReducirMovimiento();
  const entrada = useRef(new Animated.Value(0)).current;

  // Entrada elástica: la hoja sube con resorte en celular y la tarjeta crece en PC.
  useEffect(() => {
    if (!visible) return;
    entrada.setValue(reducir ? 1 : 0);
    if (!reducir) Animated.spring(entrada, { toValue: 1, friction: 8, tension: 70, useNativeDriver: usarNativo }).start();
  }, [visible, reducir, entrada]);

  const animacionTarjeta = escritorio
    ? { opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }
    : { transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [height * 0.5, 0] }) }] };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.modalFondo, escritorio ? s.modalCentro : s.modalAbajo]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar" />
        <Animated.View
          style={[
            animacionTarjeta,
            s.modalTarjeta,
            escritorio
              ? { width: '92%', maxWidth: anchoMaximo, maxHeight: height * 0.9, borderRadius: Radius.lg }
              : { width: '100%', maxHeight: height * 0.92, paddingBottom: Math.max(insets.bottom, 12), borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
          ]}
        >
          {!escritorio && <View style={s.agarre} />}
          <View style={s.modalCabecera}>
            <Text style={s.modalTitulo} numberOfLines={2}>{titulo ?? ''}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={s.cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Icono name="xmark" size={16} color={colors.textDim} />
            </Pressable>
          </View>
          {sinScroll ? (
            <View style={s.modalCuerpoFijo}>{children}</View>
          ) : (
            <ScrollView style={s.modalScroll} contentContainerStyle={s.modalCuerpo} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          )}
          {pie && <View style={s.modalPie}>{pie}</View>}
        </Animated.View>
        <CapaNotificaciones capa={capa} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilosFijos = StyleSheet.create({
  insignia: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: Radius.full, borderWidth: 1,
  },
  insigniaTexto: { fontSize: 11.5, fontWeight: '700', textTransform: 'capitalize' },
  alerta: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: Radius.sm, borderWidth: 1, marginBottom: Spacing.sm },
  alertaTexto: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  vacio: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: 10 },
  vacioTexto: { fontSize: 13.5, textAlign: 'center' },
  estrellas: { flexDirection: 'row', gap: 4 },
  kpiCabecera: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

const crearEstilos = (c: Palette) => StyleSheet.create({
  tarjeta: {
    backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.md,
  },
  kpi: {
    flexGrow: 1, flexBasis: 150, backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: c.border, padding: Spacing.md, gap: 8,
  },
  item: { backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.md, gap: 10 },
  itemCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  itemTitulo: { color: c.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  itemAcciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  kpiEtiqueta: { color: c.textDim, fontSize: 12, fontWeight: '600' },
  kpiValor: { color: c.text, fontSize: 22, fontWeight: '800' },
  modalFondo: { flex: 1, backgroundColor: c.overlay },
  modalCentro: { justifyContent: 'center', alignItems: 'center' },
  modalAbajo: { justifyContent: 'flex-end' },
  modalTarjeta: {
    backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  agarre: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.borderStrong, marginTop: 8 },
  modalCabecera: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: Spacing.md + 4, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  modalTitulo: { flex: 1, color: c.text, fontSize: 18, fontWeight: '800' },
  cerrar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardElevated },
  modalScroll: { flexGrow: 0 },
  modalCuerpo: { paddingHorizontal: Spacing.md + 4, paddingTop: 4, paddingBottom: Spacing.xl, gap: Spacing.md },
  modalCuerpoFijo: { flexShrink: 1, paddingHorizontal: Spacing.md + 4, paddingBottom: Spacing.md },
  modalPie: { paddingHorizontal: Spacing.md + 4, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: c.border },
});
