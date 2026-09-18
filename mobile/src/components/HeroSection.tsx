// Hero Section para EV Charge Móvil con orbes de gradiente de neón
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

interface HeroSectionProps {
  onNavigateMap: () => void;
  onLearnMore: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onNavigateMap,
  onLearnMore,
}) => {
  return (
    <View style={styles.container}>
      {/* Orbes de brillo de neón */}
      <View style={styles.orbWrapper}>
        <LinearGradient
          colors={['rgba(57, 169, 0, 0.35)', 'transparent']}
          style={styles.orb1}
        />
        <LinearGradient
          colors={['rgba(57, 255, 20, 0.15)', 'transparent']}
          style={styles.orb2}
        />
      </View>

      <View style={styles.content}>
        {/* Logo y Nombre */}
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.heroLogo}
          resizeMode="contain"
        />

        <Text style={styles.projectName}>EVCHARGE</Text>

        <View style={styles.eyebrowBadge}>
          <Text style={styles.eyebrowText}>Movilidad eléctrica · Colombia</Text>
        </View>

        {/* Título Principal con Acento Verde */}
        <Text style={styles.title}>
          Carga donde{'\n'}
          <Text style={styles.accentText}>necesitas,</Text>
          {'\n'}cuando necesitas.
        </Text>

        {/* Descripción */}
        <Text style={styles.subtitle}>
          Encuentra estaciones de carga compatibles con tu vehículo, traza rutas
          inteligentes y conecta con la comunidad EV de Bogotá.
        </Text>

        {/* Botones de Acción */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onNavigateMap}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.greenEv, Colors.greenDim]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <FontAwesome6 name="bolt" size={16} color={Colors.white} />
              <Text style={styles.primaryBtnText}>Iniciar navegación</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={onLearnMore}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostBtnText}>Conoce más</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bg,
    position: 'relative',
    overflow: 'hidden',
  },
  orbWrapper: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
  },
  orb1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  orb2: {
    position: 'absolute',
    bottom: 20,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  content: {
    alignItems: 'center',
    zIndex: 1,
  },
  heroLogo: {
    width: 68,
    height: 68,
    marginBottom: Spacing.xs,
  },
  projectName: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: Spacing.xs,
  },
  eyebrowBadge: {
    backgroundColor: 'rgba(57, 169, 0, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(57, 169, 0, 0.3)',
    marginBottom: Spacing.md,
  },
  eyebrowText: {
    color: Colors.greenLight,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: Colors.white,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 42,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  accentText: {
    color: Colors.greenEv,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
    marginBottom: Spacing.lg,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    shadowColor: Colors.greenEv,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ghostBtn: {
    width: '100%',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  ghostBtnText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
