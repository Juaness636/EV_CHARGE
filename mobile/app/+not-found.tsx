import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { Boton, Icono } from '../src/components/ui';

export default function NoEncontrado() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.contenedor, { backgroundColor: colors.bg }]}>
      <Icono name="plug-circle-xmark" size={48} color={colors.primary} />
      <Text style={[styles.titulo, { color: colors.text }]}>Página no encontrada</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>La ruta que buscas no existe en EV Charge.</Text>
      <Boton titulo="Volver al inicio" icono="house" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  titulo: { fontSize: 22, fontWeight: '900' },
});
