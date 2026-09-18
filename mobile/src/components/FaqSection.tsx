// Acordeón de Preguntas Frecuentes para EV Charge Móvil
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import type { FAQItem } from '../types';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS: FAQItem[] = [
  {
    pregunta: '¿Qué es EV Charge?',
    respuesta: 'Es una plataforma para encontrar estaciones de carga, revisar sus cargadores y organizar la recarga de tu vehículo eléctrico en Colombia.',
  },
  {
    pregunta: '¿Cómo encuentro un cargador compatible?',
    respuesta: 'Registra tu vehículo y usa el filtro correspondiente. El mapa resaltará los cargadores que coinciden con el tipo de conector de tu vehículo.',
  },
  {
    pregunta: '¿Cómo hago una reserva?',
    respuesta: 'Abre el mapa, selecciona una estación y el cargador compatible. Después elige la fecha, la hora y la duración de la recarga.',
  },
  {
    pregunta: '¿Puedo ver el precio antes de reservar?',
    respuesta: 'Sí. En la información del cargador puedes cambiar la duración y consultar el valor estimado antes de confirmar.',
  },
  {
    pregunta: '¿Qué significan los colores de las estaciones?',
    respuesta: 'Verde significa disponibilidad, naranja o rojo indica mantenimiento o fuera de servicio y azul indica que los cargadores están reservados.',
  },
  {
    pregunta: '¿Qué hago si encuentro un problema?',
    respuesta: 'Puedes reportarlo desde la información de la estación. También puedes calificarla y revisar los reportes de otros usuarios.',
  },
];

export const FaqSection: React.FC = () => {
  const [abierta, setAbierta] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAbierta(abierta === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>AYUDA RÁPIDA</Text>
        <Text style={styles.title}>Preguntas frecuentes</Text>
        <Text style={styles.subtitle}>
          Resuelve tus dudas sobre el mapa, las reservas y tu vehículo eléctrico.
        </Text>
      </View>

      <View style={styles.list}>
        {FAQS.map((faq, index) => {
          const isOpen = abierta === index;
          return (
            <View
              key={index}
              style={[styles.faqItem, isOpen && styles.faqItemOpen]}
            >
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => toggleFaq(index)}
                activeOpacity={0.8}
              >
                <Text style={[styles.questionText, isOpen && styles.questionTextOpen]}>
                  {faq.pregunta}
                </Text>
                <View style={styles.iconCircle}>
                  <FontAwesome6
                    name={isOpen ? 'minus' : 'plus'}
                    size={12}
                    color={isOpen ? Colors.greenEv : Colors.textDim}
                  />
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.faqBody}>
                  <Text style={styles.answerText}>{faq.respuesta}</Text>
                </View>
              )}
            </View>
          );
        })}
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
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  list: {
    gap: Spacing.sm,
  },
  faqItem: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  faqItemOpen: {
    borderColor: Colors.borderGreen,
    backgroundColor: '#161d15',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  questionText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    paddingRight: Spacing.sm,
  },
  questionTextOpen: {
    color: Colors.greenLight,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  answerText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
