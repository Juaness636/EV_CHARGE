import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
        variante === 'primary' && !inactivo && { shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
        bloque && styles.bloque,
        disabled && !cargando && styles.inactivo,
        style,
      ]}
    >
      {variante === 'primary' && (
        // Degradado diagonal con un brillo superior: da volumen al botón principal.
        <LinearGradient
          colors={[colors.primary, colors.primaryDim]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: pequeno ? Radius.sm : Radius.md }]}
          pointerEvents="none"
        >
          <View style={styles.brillo} />
        </LinearGradient>
      )}
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
  // 40 px de alto: área táctil cómoda en el celular aunque el botón sea "pequeño".
  pequeno: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 40, borderRadius: Radius.sm },
  bloque: { alignSelf: 'stretch' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  texto: { fontSize: 14, fontWeight: '700' },
  textoPequeno: { fontSize: 12.5 },
  inactivo: { opacity: 0.5 },
  brillo: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.12)', borderTopLeftRadius: Radius.md, borderTopRightRadius: Radius.md },
});
