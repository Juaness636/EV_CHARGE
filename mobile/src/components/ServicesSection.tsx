// Sección de Servicios ("Lo que hacemos") para EV Charge Móvil
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

const SERVICES = [
  {
    id: '1',
    titulo: 'Mapa en tiempo real',
    descripcion: 'Visualiza todas las estaciones de carga cerca de ti en Bogotá, con información actualizada.',
    icon: 'map-location-dot',
    image: require('../../assets/images/seccion1.png'),
  },
  {
    id: '2',
    titulo: 'Filtro por tu vehículo',
    descripcion: 'Registra tu auto y el sistema filtra automáticamente las estaciones compatibles.',
    icon: 'car-side',
    image: require('../../assets/images/seccion2.png'),
  },
  {
    id: '3',
    titulo: 'Planificador de viaje',
    descripcion: 'Calcula las paradas de recarga óptimas según tu autonomía usando rutas viales reales.',
    icon: 'compass',
    image: require('../../assets/images/seccion3.png'),
  },
  {
    id: '4',
    titulo: 'Comunidad activa',
    descripcion: 'Califica estaciones, reporta cargadores dañados y consulta la experiencia de otros conductores.',
    icon: 'star',
    image: require('../../assets/images/seccion4.png'),
  },
  {
    id: '5',
    titulo: 'Historial de cargas',
    descripcion: 'Lleva el registro de cada sesión: kWh cargados, costo estimado y estación utilizada.',
    icon: 'clipboard-list',
    image: require('../../assets/images/seccion5.png'),
  },
  {
    id: '6',
    titulo: 'Reservas inteligentes',
    descripcion: 'Programa tus recargas con anticipación, reserva estaciones disponibles y organiza tus viajes.',
    icon: 'calendar-check',
    image: require('../../assets/images/seccion6.png'),
  },
];

export const ServicesSection: React.FC = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>LO QUE HACEMOS</Text>
        <Text style={styles.title}>Todo lo que necesita tu vehículo eléctrico</Text>
      </View>

      <View style={styles.grid}>
        {SERVICES.map((srv) => (
          <View key={srv.id} style={styles.card}>
            <View style={styles.imageContainer}>
              <Image source={srv.image} style={styles.image} resizeMode="cover" />
            </View>

            <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                <View style={styles.iconCircle}>
                  <FontAwesome6 name={srv.icon} size={14} color={Colors.greenEv} />
                </View>
                <Text style={styles.cardTitle}>{srv.titulo}</Text>
              </View>

              <Text style={styles.cardDesc}>{srv.descripcion}</Text>
            </View>
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
    height: 150,
    width: '100%',
    backgroundColor: '#1a1a1a',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cardContent: {
    padding: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.xs,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  cardDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
