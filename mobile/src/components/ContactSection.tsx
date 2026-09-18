// Formulario de Contacto para EV Charge Móvil
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { enviarContacto } from '../api/contacto.api';

export const ContactSection: React.FC = () => {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [alerta, setAlerta] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const handleSubmit = async () => {
    if (!nombre.trim() || !apellido.trim() || !correo.trim() || !mensaje.trim()) {
      setAlerta({ tipo: 'error', texto: 'Por favor, completa todos los campos.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo.trim())) {
      setAlerta({ tipo: 'error', texto: 'Ingresa un correo electrónico válido.' });
      return;
    }

    setEnviando(true);
    setAlerta(null);

    try {
      await enviarContacto({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: correo.trim(),
        mensaje: mensaje.trim(),
      });

      setAlerta({
        tipo: 'success',
        texto: '¡Mensaje enviado correctamente! Nos pondremos en contacto.',
      });
      setNombre('');
      setApellido('');
      setCorreo('');
      setMensaje('');
    } catch {
      setAlerta({
        tipo: 'error',
        texto: 'No se pudo enviar el mensaje. Verifica tu conexión.',
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CONTACTO</Text>
        <Text style={styles.title}>¿Tienes una estación de carga que quieras registrar?</Text>
        <Text style={styles.subtitle}>Escríbenos y la agregamos al mapa.</Text>
      </View>

      <View style={styles.formCard}>
        {alerta && (
          <View
            style={[
              styles.alertBox,
              alerta.tipo === 'error' ? styles.alertError : styles.alertSuccess,
            ]}
          >
            <FontAwesome6
              name={alerta.tipo === 'error' ? 'circle-exclamation' : 'circle-check'}
              size={14}
              color={alerta.tipo === 'error' ? Colors.error : Colors.success}
            />
            <Text
              style={[
                styles.alertText,
                { color: alerta.tipo === 'error' ? Colors.error : Colors.success },
              ]}
            >
              {alerta.texto}
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu nombre"
              placeholderTextColor={Colors.textDim}
              value={nombre}
              onChangeText={setNombre}
            />
          </View>

          <View style={styles.halfInput}>
            <Text style={styles.label}>Apellido</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu apellido"
              placeholderTextColor={Colors.textDim}
              value={apellido}
              onChangeText={setApellido}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={Colors.textDim}
            keyboardType="email-address"
            autoCapitalize="none"
            value={correo}
            onChangeText={setCorreo}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mensaje</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Cuéntanos sobre la estación o tu consulta..."
            placeholderTextColor={Colors.textDim}
            multiline
            numberOfLines={4}
            value={mensaje}
            onChangeText={setMensaje}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, enviando && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={enviando}
          activeOpacity={0.85}
        >
          {enviando ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Enviar mensaje</Text>
              <FontAwesome6 name="paper-plane" size={14} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
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
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  alertError: {
    backgroundColor: Colors.errorBg,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  alertSuccess: {
    backgroundColor: Colors.successBg,
    borderColor: 'rgba(57, 169, 0, 0.4)',
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    color: Colors.white,
    fontSize: 14,
  },
  textarea: {
    height: 90,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: Colors.greenEv,
    borderRadius: Radius.md,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
});
