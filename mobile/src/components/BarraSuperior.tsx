// Barra superior de pantallas secundarias (mapa, productos): volver, logo y acciones.
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Logo } from './Cabecera';
import { Icono } from './ui';

export function BarraSuperior({ derecha, izquierda }: { derecha?: ReactNode; izquierda?: ReactNode }) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.barra, { paddingTop: insets.top + 8, backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <View style={styles.lado}>
        {izquierda ?? (
          <Pressable onPress={volver} style={[styles.volver, { borderColor: colors.border, backgroundColor: colors.cardElevated }]} accessibilityRole="button" accessibilityLabel="Volver">
            <Icono name="arrow-left" size={14} color={colors.text} />
            {width >= 600 && <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Inicio</Text>}
          </Pressable>
        )}
      </View>
      <Logo mostrarNombre={width >= 420} />
      <View style={[styles.lado, { justifyContent: 'flex-end' }]}>{derecha}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, gap: 8, zIndex: 10 },
  lado: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1 },
});
