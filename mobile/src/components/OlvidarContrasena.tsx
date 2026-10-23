// Recuperación de contraseña en 3 pasos: correo -> código de 6 dígitos -> nueva contraseña.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { solicitarCodigoRecuperacion, verificarPinRecuperacion, restablecerPassword } from '../api/auth.api';
import { mensajeError } from '../api/httpClient';
import { useTheme } from '../theme/ThemeContext';
import { emailValido, requisitosPassword } from '../utils/formato';
import { notificar } from './Notificaciones';
import { CheckAnimado } from './animacion';
import { Alerta, Boton, CampoTexto, Icono } from './ui';

export function OlvidarContrasena({ onVolverAlLogin }: { onVolverAlLogin: () => void }) {
  const { colors } = useTheme();
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const pedirCodigo = async () => {
    setError('');
    if (!emailValido(email)) return setError('Ingresa un correo válido (ejemplo@correo.com).');
    setCargando(true);
    try {
      await solicitarCodigoRecuperacion(email);
      notificar({ titulo: 'Recuperación de contraseña', mensaje: 'Si el correo está registrado, recibirás un código de 6 dígitos.', tipo: 'success', duracionMs: 8000 });
      setPaso(2);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo generar el código.'));
    } finally {
      setCargando(false);
    }
  };

  const revisarCodigo = async () => {
    setError('');
    if (pin.length !== 6) return setError('El código debe tener 6 números.');
    setCargando(true);
    try {
      const data = await verificarPinRecuperacion(email, pin);
      setToken(data.reset_token);
      setPaso(3);
    } catch (e) {
      setError(mensajeError(e, 'El código no es válido o ya venció.'));
    } finally {
      setCargando(false);
    }
  };

  const guardarNueva = async () => {
    setError('');
    if (nueva !== confirmacion) return setError('Las contraseñas no coinciden.');
    if (!Object.values(requisitosPassword(nueva)).every(Boolean)) {
      return setError('La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y símbolo.');
    }
    setCargando(true);
    try {
      await restablecerPassword(token, nueva);
      setPaso(4);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cambiar la contraseña.'));
    } finally {
      setCargando(false);
    }
  };

  const pasos = ['Correo', 'Código', 'Contraseña'];

  return (
    <View style={{ gap: 6 }}>
      {paso < 4 && (
        <View style={[styles.stepper, { borderBottomColor: colors.border }]}>
          {pasos.map((nombre, i) => (
            <Text key={nombre} style={[styles.paso, { color: paso >= i + 1 ? colors.primary : colors.textDim }]}>
              {i + 1}. {nombre}
            </Text>
          ))}
        </View>
      )}
      {error ? <Alerta texto={error} /> : null}

      {paso === 1 && (
        <>
          <Text style={[styles.titulo, { color: colors.text }]}>¿Olvidaste tu contraseña?</Text>
          <Text style={[styles.subtitulo, { color: colors.textMuted }]}>Escribe tu correo registrado para recibir un código de recuperación.</Text>
          <CampoTexto etiqueta="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="correo@ejemplo.com" />
          <Boton titulo={cargando ? 'Generando código...' : 'Generar código'} cargando={cargando} onPress={pedirCodigo} bloque />
        </>
      )}

      {paso === 2 && (
        <>
          <Text style={[styles.titulo, { color: colors.text }]}>Escribe el código</Text>
          <Text style={[styles.subtitulo, { color: colors.textMuted }]}>Revisa tu correo {email} y escribe el código de 6 números.</Text>
          <CampoTexto etiqueta="Código de 6 números" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" maxLength={6} />
          <Boton titulo="Revisar código" cargando={cargando} onPress={revisarCodigo} bloque />
          <Boton titulo="Cambiar correo" variante="outline" pequeno onPress={() => setPaso(1)} />
        </>
      )}

      {paso === 3 && (
        <>
          <Text style={[styles.titulo, { color: colors.text }]}>Nueva contraseña</Text>
          <Text style={[styles.subtitulo, { color: colors.textMuted }]}>Escribe y confirma tu nueva contraseña.</Text>
          <CampoTexto etiqueta="Nueva contraseña" value={nueva} onChangeText={setNueva} password placeholder="••••••••" autoCapitalize="none" />
          <CampoTexto etiqueta="Repetir contraseña" value={confirmacion} onChangeText={setConfirmacion} password placeholder="••••••••" autoCapitalize="none" error={confirmacion && nueva !== confirmacion ? 'Las contraseñas no coinciden' : undefined} />
          <Boton titulo="Cambiar contraseña" cargando={cargando} disabled={!nueva || nueva !== confirmacion} onPress={guardarNueva} bloque />
        </>
      )}

      {paso === 4 && (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 10 }}>
          <CheckAnimado tamano={60} />
          <Text style={[styles.titulo, { color: colors.text }]}>Contraseña actualizada</Text>
          <Text style={[styles.subtitulo, { color: colors.textMuted, textAlign: 'center' }]}>Ya puedes iniciar sesión con tu nueva contraseña.</Text>
          <Boton titulo="Volver al inicio de sesión" onPress={onVolverAlLogin} bloque />
        </View>
      )}

      {paso < 4 && <Boton titulo="← Volver al inicio de sesión" variante="ghost" pequeno onPress={onVolverAlLogin} />}
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1 },
  paso: { fontSize: 12, fontWeight: '700' },
  titulo: { fontSize: 18, fontWeight: '800' },
  subtitulo: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
});
