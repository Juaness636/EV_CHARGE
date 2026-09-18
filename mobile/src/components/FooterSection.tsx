// Pie de Página móvil para EV Charge
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';

export const FooterSection: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <View style={styles.footer}>
      {/* Marca y Resumen */}
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.brandName}>EV Charge</Text>
          <Text style={styles.brandTagline}>Movilidad Eléctrica</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Plataforma inteligente para localizar y gestionar estaciones de carga para
        vehículos eléctricos en Colombia.
      </Text>

      {/* Datos de contacto */}
      <View style={styles.contactBlock}>
        <View style={styles.contactRow}>
          <FontAwesome6 name="envelope" size={12} color={Colors.greenEv} />
          <Text style={styles.contactText}>eevcharge@gmail.com</Text>
        </View>
        <View style={styles.contactRow}>
          <FontAwesome6 name="location-dot" size={12} color={Colors.greenEv} />
          <Text style={styles.contactText}>Bogotá D.C., Colombia</Text>
        </View>
        <View style={styles.contactRow}>
          <FontAwesome6 name="phone" size={12} color={Colors.greenEv} />
          <Text style={styles.contactText}>+57 300 123 4567</Text>
        </View>
      </View>

      {/* Créditos académicos */}
      <View style={styles.academicBox}>
        <Text style={styles.academicText}>Versión 2.0 · Proyecto Académico SENA ADSO</Text>
      </View>

      {/* Derechos de Autor */}
      <View style={styles.copyrightRow}>
        <Text style={styles.copyrightText}>
          © {currentYear} EV Charge. Todos los derechos reservados.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    backgroundColor: '#070707',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandName: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  brandTagline: {
    color: Colors.greenEv,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  description: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  contactBlock: {
    gap: 8,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: Spacing.md,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactText: {
    color: Colors.text,
    fontSize: 12,
  },
  academicBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  academicText: {
    color: Colors.textDim,
    fontSize: 11,
  },
  copyrightRow: {
    alignItems: 'center',
  },
  copyrightText: {
    color: Colors.textDim,
    fontSize: 11,
  },
});
