// Sección "En números" (Estadísticas) para EV Charge Móvil
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

const STATS = [
  { cifra: '47', etiqueta: 'Estaciones en Bogotá' },
  { cifra: '20', etiqueta: 'km de radio cubierto' },
  { cifra: '5', etiqueta: 'Tipos de conector' },
  { cifra: '100%', etiqueta: '% open source' },
];

export const StatsSection: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>EN NÚMEROS</Text>
        <Text style={styles.title}>La red eléctrica que ya existe</Text>
      </View>

      <View style={styles.grid}>
        {STATS.map((item, index) => (
          <View key={index} style={styles.statCard}>
            <Text style={styles.cifra}>{item.cifra}</Text>
            <Text style={styles.etiqueta}>{item.etiqueta}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    color: Colors.greenEv,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cifra: {
    color: Colors.green,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  etiqueta: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
});
