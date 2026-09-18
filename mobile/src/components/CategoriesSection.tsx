// Sección de Categorías para EV Charge Móvil
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import type { CategoriaKey } from '../types';

interface CategoriesSectionProps {
  onSelectCategory?: (category: CategoriaKey) => void;
}

const CATEGORIES = [
  {
    key: 'Cargadores' as CategoriaKey,
    titulo: 'Cargadores',
    descripcion: 'Cargadores para vehículos eléctricos de diferentes potencias y necesidades.',
    image: require('../../assets/images/wallbox-22kw.png'),
    icon: 'charging-station',
  },
  {
    key: 'Llantas' as CategoriaKey,
    titulo: 'Llantas',
    descripcion: 'Llantas diseñadas para ofrecer seguridad y rendimiento en tu vehículo eléctrico.',
    image: require('../../assets/images/seccion2.png'),
    icon: 'circle-dot',
  },
  {
    key: 'Baterías' as CategoriaKey,
    titulo: 'Baterías',
    descripcion: 'Soluciones de energía y baterías para mejorar la autonomía de tu vehículo.',
    image: require('../../assets/images/seccion3.png'),
    icon: 'battery-full',
  },
  {
    key: 'Cables y conectores' as CategoriaKey,
    titulo: 'Cables y conectores',
    descripcion: 'Cables, conectores y accesorios para realizar tus cargas de forma segura.',
    image: require('../../assets/images/cargador-portatil-74kw.png'),
    icon: 'plug',
  },
];

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  onSelectCategory,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CATEGORÍAS</Text>
        <Text style={styles.title}>Encuentra lo que necesitas para tu vehículo</Text>
        <Text style={styles.subtitle}>
          Explora nuestras categorías de productos y soluciones para movilidad eléctrica.
        </Text>
      </View>

      <View style={styles.grid}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => onSelectCategory?.(cat.key)}
          >
            <View style={styles.imageContainer}>
              <Image source={cat.image} style={styles.image} resizeMode="contain" />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <FontAwesome6 name={cat.icon} size={15} color={Colors.greenEv} />
                <Text style={styles.cardTitle}>{cat.titulo}</Text>
              </View>

              <Text style={styles.cardDesc} numberOfLines={2}>
                {cat.descripcion}
              </Text>

              <View style={styles.actionRow}>
                <Text style={styles.actionText}>Explorar categoría</Text>
                <FontAwesome6 name="arrow-right" size={11} color={Colors.greenEv} />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg2,
  },
  header: {
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
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  grid: {
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 140,
    backgroundColor: '#1b1e1b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardBody: {
    padding: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  cardDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: Colors.greenEv,
    fontSize: 12,
    fontWeight: '700',
  },
});
