import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Radius } from '../../theme/spacing';
import { LogoCargando } from '../animacion';
import { Icono } from './Icono';
import { Presionable } from './Presionable';

type Variante = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft';

interface Props {
  titulo: string;
  onPress?: () => void;
  variante?: Variante;
  icono?: string;
  iconoDerecha?: boolean;
  cargando?: boolean;
  disabled?: boolean;
  pequeno?: boolean;
  bloque?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Boton({
  titulo, onPress, variante = 'primary', icono, iconoDerecha = false, cargando = false,
  disabled = false, pequeno = false, bloque = false, style, accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const inactivo = disabled || cargando;

  const fondo: Record<Variante, string> = {
    primary: colors.primary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: colors.errorSoft,
    soft: colors.primarySoft,
  };
  const borde: Record<Variante, string> = {
    primary: colors.primary,
    outline: colors.borderStrong,
    ghost: 'transparent',
    danger: 'rgba(231, 76, 60, 0.45)',
    soft: colors.primaryBorder,
  };
  const texto: Record<Variante, string> = {
    primary: colors.onPrimary,
    outline: colors.text,
    ghost: colors.primary,
    danger: colors.error,
    soft: colors.primary,
  };

  const color = texto[variante];
  const contenidoIcono = icono ? <Icono name={icono} size={pequeno ? 12 : 14} color={color} /> : null;

  return (
    <Presionable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      disabled={inactivo}
      onPress={onPress}
      elevarAlPasar={variante === 'primary'}
      style={[
        styles.base,
        pequeno ? styles.pequeno : styles.normal,
        { backgroundColor: fondo[variante], borderColor: borde[variante] },
        variante === 'primary' && !inactivo && { shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
        bloque && styles.bloque,
        disabled && !cargando && styles.inactivo,
        style,
      ]}
    >
      <View style={styles.fila}>
        {cargando ? <LogoCargando tamano={pequeno ? 18 : 22} color={color} conHalo={false} /> : !iconoDerecha && contenidoIcono}
        <Text style={[styles.texto, pequeno && styles.textoPequeno, { color }]} numberOfLines={1}>{titulo}</Text>
        {!cargando && iconoDerecha && contenidoIcono}
      </View>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  normal: { paddingVertical: 12, paddingHorizontal: 18, minHeight: 46 },
  pequeno: { paddingVertical: 7, paddingHorizontal: 12, minHeight: 34, borderRadius: Radius.sm },
  bloque: { alignSelf: 'stretch' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  texto: { fontSize: 14, fontWeight: '700' },
  textoPequeno: { fontSize: 12.5 },
  inactivo: { opacity: 0.5 },
});
