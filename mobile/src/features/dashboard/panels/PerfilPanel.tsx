// Perfil del usuario o del administrador: datos personales, privacidad en reservas
// y cambio de contraseña con validación de requisitos.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { actualizarPerfil, cambiarPassword } from '../../../api/auth.api';
import { mensajeError } from '../../../api/httpClient';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../theme/ThemeContext';
import { emailValido, listaRequisitosPassword, requisitosPassword } from '../../../utils/formato';
import { notificar } from '../../../components/Notificaciones';
import { Boton, CampoTexto, Casilla, Icono, Insignia, Tarjeta } from '../../../components/ui';

export function PerfilPanel({ esAdmin = false }: { esAdmin?: boolean }) {
  const { colors } = useTheme();
  const { usuario, actualizarUsuario } = useAuth();
  const [form, setForm] = useState({ nombre: usuario?.nombre || '', apellido: usuario?.apellido || '', email: usuario?.email || '' });
  const [compartir, setCompartir] = useState(Boolean(usuario?.compartir_nombre_reserva));
  const [errores, setErrores] = useState({ nombre: '', apellido: '', email: '' });
  const [guardando, setGuardando] = useState(false);
  const [pass, setPass] = useState({ actual: '', nueva: '', confirmacion: '' });
  const [erroresPass, setErroresPass] = useState({ actual: '', nueva: '', confirmacion: '' });
  const [guardandoPass, setGuardandoPass] = useState(false);

  const requisitos = requisitosPassword(pass.nueva);
  const cumplidos = Object.values(requisitos).filter(Boolean).length;

  const guardar = async () => {
    const e = {
      nombre: form.nombre.trim() ? '' : 'Rellena este campo',
      apellido: form.apellido.trim() ? '' : 'Rellena este campo',
      email: !form.email.trim() ? 'Rellena este campo' : emailValido(form.email) ? '' : 'El correo debe tener un formato válido (ejemplo@correo.com)',
    };
    setErrores(e);
    if (e.nombre || e.apellido || e.email) return notificar({ tipo: 'warning', titulo: 'Perfil', mensaje: 'Completa todos los campos correctamente.' });
    setGuardando(true);
    try {
      const { usuario: actualizado } = await actualizarPerfil({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim(),
        ...(esAdmin ? {} : { compartir_nombre_reserva: compartir }),
      });
      actualizarUsuario(actualizado);
      notificar({ tipo: 'success', titulo: 'Perfil', mensaje: 'Perfil actualizado correctamente.' });
    } catch (err) {
      const mensaje = mensajeError(err);
      if (/correo/i.test(mensaje)) setErrores({ ...e, email: 'Este correo ya está registrado por otro usuario' });
      notificar({ tipo: 'error', titulo: 'Perfil', mensaje });
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = async () => {
    const e = {
      actual: pass.actual ? '' : 'Rellena este campo',
      nueva: !pass.nueva ? 'Rellena este campo' : cumplidos < 5 ? 'La contraseña no cumple los requisitos de seguridad' : '',
      confirmacion: !pass.confirmacion ? 'Rellena este campo' : pass.nueva !== pass.confirmacion ? 'Las contraseñas no coinciden' : '',
    };
    setErroresPass(e);
    if (e.actual || e.nueva || e.confirmacion) return;
    setGuardandoPass(true);
    try {
      await cambiarPassword(pass.actual, pass.nueva);
      setPass({ actual: '', nueva: '', confirmacion: '' });
      notificar({ tipo: 'success', titulo: 'Contraseña', mensaje: 'Contraseña actualizada correctamente.' });
    } catch (err) {
      const mensaje = mensajeError(err);
      if (/incorrect/i.test(mensaje)) setErroresPass({ ...e, actual: 'Contraseña incorrecta' });
      notificar({ tipo: 'error', titulo: 'Contraseña', mensaje });
    } finally {
      setGuardandoPass(false);
    }
  };

  const iniciales = `${(usuario?.nombre || 'U').charAt(0)}${(usuario?.apellido || '').charAt(0)}`.toUpperCase();

  return (
    <>
      <Tarjeta style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarTexto}>{iniciales}</Text></View>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Mi perfil</Text>
          <Text style={{ color: colors.textMuted }}>Gestiona tus datos personales y protege el acceso a tu cuenta.</Text>
        </View>
        <Insignia texto={esAdmin ? 'Administrador' : 'Usuario'} tono="verde" icono={esAdmin ? 'shield-halved' : 'user-check'} />
      </Tarjeta>

      <Tarjeta>
        <View style={styles.seccion}>
          <Icono name="user" size={14} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>Datos personales</Text>
        </View>
        <CampoTexto etiqueta="Nombre" requerido value={form.nombre} onChangeText={(v) => { setForm({ ...form, nombre: v }); setErrores({ ...errores, nombre: '' }); }} error={errores.nombre} />
        <CampoTexto etiqueta="Apellido" requerido value={form.apellido} onChangeText={(v) => { setForm({ ...form, apellido: v }); setErrores({ ...errores, apellido: '' }); }} error={errores.apellido} />
        <CampoTexto etiqueta="Correo" requerido value={form.email} onChangeText={(v) => { setForm({ ...form, email: v }); setErrores({ ...errores, email: '' }); }} keyboardType="email-address" autoCapitalize="none" error={errores.email} />
        {!esAdmin && (
          <Casilla marcada={compartir} onChange={setCompartir}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Compartir mi nombre en las reservas</Text>
            <Text style={{ color: colors.textDim, fontSize: 12 }}>Si está activo, otros usuarios verán tu nombre únicamente en el cargador que reservaste.</Text>
          </Casilla>
        )}
        <Boton titulo={guardando ? 'Guardando...' : 'Guardar cambios'} cargando={guardando} onPress={guardar} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </Tarjeta>

      <Tarjeta>
        <View style={styles.seccion}>
          <Icono name="lock" size={14} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: '800' }}>Cambiar contraseña</Text>
        </View>
        <CampoTexto etiqueta="Contraseña actual" password value={pass.actual} onChangeText={(v) => { setPass({ ...pass, actual: v }); setErroresPass({ ...erroresPass, actual: '' }); }} autoCapitalize="none" error={erroresPass.actual} />
        <CampoTexto etiqueta="Nueva contraseña" password value={pass.nueva} onChangeText={(v) => { setPass({ ...pass, nueva: v }); setErroresPass({ ...erroresPass, nueva: '' }); }} autoCapitalize="none" error={erroresPass.nueva} />
        {pass.nueva.length > 0 && (
          <View style={{ gap: 4, marginBottom: 10 }}>
            <Text style={{ color: colors.textDim, fontSize: 12, fontWeight: '700' }}>Requisitos de seguridad: {cumplidos}/5</Text>
            {listaRequisitosPassword.map(([clave, texto]) => (
              <Text key={clave} style={{ color: requisitos[clave] ? colors.primary : colors.textDim, fontSize: 12 }}>
                <Icono name={requisitos[clave] ? 'check' : 'xmark'} size={10} color={requisitos[clave] ? colors.primary : colors.error} />  {texto}
              </Text>
            ))}
          </View>
        )}
        <CampoTexto etiqueta="Confirmar contraseña" password value={pass.confirmacion} onChangeText={(v) => { setPass({ ...pass, confirmacion: v }); setErroresPass({ ...erroresPass, confirmacion: '' }); }} autoCapitalize="none" error={erroresPass.confirmacion} />
        <Boton titulo={guardandoPass ? 'Actualizando...' : 'Actualizar contraseña'} cargando={guardandoPass} onPress={cambiar} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
      </Tarjeta>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: '#fff', fontWeight: '900', fontSize: 20 },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
});
