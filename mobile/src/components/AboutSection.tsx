// Sección "Quiénes somos" para EV Charge Móvil
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

interface AboutSectionProps {
  onContactPress?: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onContactPress }) => {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(57, 169, 0, 0.1)', 'rgba(0, 0, 0, 0.6)']}
        style={styles.gradientCard}
      >
        <View style={styles.bannerImageContainer}>
          <Image
            source={require('../../assets/images/banner.png')}
            style={styles.bannerImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.body}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>QUIÉNES SOMOS</Text>
          </View>

          <Text style={styles.title}>EV Charge</Text>

          <Text style={styles.highlightDesc}>
            Proyecto desarrollado por aprendices ADSO del SENA.
          </Text>

          <Text style={styles.description}>
            Impulsamos la movilidad eléctrica mediante una plataforma inteligente para
            localizar estaciones de carga, administrar vehículos, gestionar reservas y
            ofrecer una mejor experiencia a los conductores de vehículos eléctricos en Colombia.
          </Text>

          {onContactPress && (
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={onContactPress}
              activeOpacity={0.8}
            >
              <Text style={styles.contactBtnText}>Contáctanos</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bg2,
  },
  gradientCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderGreen,
    overflow: 'hidden',
  },
  bannerImageContainer: {
    height: 160,
    backgroundColor: '#0a0d0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: Spacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(57, 169, 0, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    color: Colors.greenEv,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: Colors.white,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: Spacing.xs,
  },
  highlightDesc: {
    color: Colors.greenLight,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  contactBtn: {
    backgroundColor: Colors.greenEv,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
