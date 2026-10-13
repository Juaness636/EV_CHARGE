// Modal global de autenticación: iniciar sesión, registrarse y recuperar contraseña.
// Incluye "Recuérdame", captcha simulado tras varios intentos y medidor de contraseña,
// igual que el landing del frontend web.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { registro, ApiError } from '../api/auth.api';
import { useAuth } from '../context/AuthContext';
import { useUI, type AuthTab } from '../context/UIContext';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { emailValido, listaRequisitosPassword, requisitosPassword } from '../utils/formato';
import { OlvidarContrasena } from './OlvidarContrasena';
import { Aparecer, Respirar } from './animacion';
import { notificar } from './Notificaciones';
import { Alerta, AppModal, Boton, CampoTexto, Casilla, Icono } from './ui';

const CLAVE_RECORDAR = 'ev_remember';
const CLAVE_RECORDAR_EMAIL = 'ev_remember_email';

function CaptchaSimulado({ verificado, onVerificar }: { verificado: boolean; onVerificar: () => void }) {
  const [cargando, setCargando] = useState(false);
  const { colors } = useTheme();
  const tocar = () => {
    if (verificado || cargando) return;
    setCargando(true);
    setTimeout(() => {
      setCargando(false);
      onVerificar();
    }, 1000);
  };
  return (
    <Pressable onPress={tocar} style={[styles.captcha, { borderColor: colors.borderStrong, backgroundColor: colors.cardElevated }]} accessibilityRole="checkbox" accessibilityState={{ checked: verificado }}>
      <View style={[styles.captchaCaja, { borderColor: verificado ? colors.primary : colors.borderStrong }]}>
        {cargando ? <ActivityIndicator size="small" color={colors.textDim} /> : verificado ? <Icono name="check" size={16} color={colors.primary} /> : null}
      </View>
      <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }}>No soy un robot</Text>
      <Icono name="shield-halved" size={20} color={colors.textDim} />
    </Pressable>
  );
}

export function AuthModal() {
  const { colors } = useTheme();
  const { authVisible, authTab, authMensaje, cerrarAuth, setAuthTab } = useUI();
  const { login } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  const [alerta, setAlerta] = useState<{ texto: string; tipo: 'error' | 'success' } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [captchaRequerido, setCaptchaRequerido] = useState(false);
  const [captchaResuelto, setCaptchaResuelto] = useState(false);
  const [recordarme, setRecordarme] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [reg, setReg] = useState({ nombre: '', apellido: '', email: '', pass: '', confirmacion: '' });

  useEffect(() => {
    if (!authVisible) return;
    setAlerta(authMensaje ? { texto: authMensaje, tipo: 'error' } : null);
    Promise.all([AsyncStorage.getItem(CLAVE_RECORDAR), AsyncStorage.getItem(CLAVE_RECORDAR_EMAIL)])
      .then(([recordar, email]) => {
        if (recordar === 'true' && email) {
          setRecordarme(true);
          setLoginEmail((actual) => actual || email);
        }
      })
      .catch(() => undefined);
  }, [authVisible, authMensaje]);

  const requisitos = useMemo(() => ({ ...requisitosPassword(reg.pass), same: reg.pass !== '' && reg.pass === reg.confirmacion }), [reg.pass, reg.confirmacion]);
  const puntaje = Object.values(requisitos).filter(Boolean).length;
  const porcentaje = (puntaje / 6) * 100;

  const cambiarTab = (tab: AuthTab) => {
    setAuthTab(tab);
    setAlerta(null);
  };

  const hacerLogin = async () => {
    const email = loginEmail.trim();
    if (!email || !loginPass) return setAlerta({ texto: 'Por favor, completa el correo y la contraseña.', tipo: 'error' });
    if (!emailValido(email)) return setAlerta({ texto: 'Ingresa un correo válido (ejemplo@correo.com).', tipo: 'error' });
    if (captchaRequerido && !captchaResuelto) return setAlerta({ texto: 'Por favor, verifica que no eres un robot.', tipo: 'error' });

    setCargando(true);
    setAlerta(null);
    try {
      const usuario = await login(email, loginPass);
      if (recordarme) await AsyncStorage.multiSet([[CLAVE_RECORDAR, 'true'], [CLAVE_RECORDAR_EMAIL, email]]);
      else await AsyncStorage.multiRemove([CLAVE_RECORDAR, CLAVE_RECORDAR_EMAIL]);
      setLoginPass('');
      setCaptchaRequerido(false);
      cerrarAuth();
      notificar({ tipo: 'success', titulo: 'Bienvenido', mensaje: `Hola, ${usuario.nombre}. Sesión iniciada correctamente.` });
      // Desde el inicio se va al panel; desde el mapa o productos se queda en la misma pantalla.
      if ((segments as string[]).length === 0) router.push(usuario.is_admin ? '/admin' : '/dashboard');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      const status = error instanceof ApiError ? error.status : 0;
      if (mensaje === 'captcha_required') {
        setCaptchaRequerido(true);
        setCaptchaResuelto(false);
        setAlerta({ texto: 'Demasiados intentos. Verifica que no eres un robot.', tipo: 'error' });
      } else if (mensaje.includes('minutos')) {
        setCaptchaRequerido(false);
        setAlerta({ texto: mensaje, tipo: 'error' });
      } else if ([400, 401, 422].includes(status) || /credenciales|contraseña|incorrect/i.test(mensaje)) {
        setAlerta({ texto: 'Correo o contraseña incorrectos.', tipo: 'error' });
        if (captchaRequerido) setCaptchaResuelto(false);
      } else {
        setAlerta({ texto: status === 0 ? mensaje : 'No se pudo iniciar sesión. Verifica que el backend esté activo.', tipo: 'error' });
      }
    } finally {
      setCargando(false);
    }
  };

  const hacerRegistro = async () => {
    const { nombre, apellido, email, pass, confirmacion } = reg;
    if (!nombre.trim() || !apellido.trim() || !email.trim() || !pass || !confirmacion) {
      return setAlerta({ texto: 'Por favor, digita todos los datos solicitados.', tipo: 'error' });
    }
    if (!emailValido(email)) return setAlerta({ texto: 'Ingresa un correo válido (ejemplo@correo.com).', tipo: 'error' });
    if (puntaje < 6) return setAlerta({ texto: 'Tu contraseña no cumple todos los requisitos.', tipo: 'error' });

    setCargando(true);
    setAlerta(null);
    try {
      await registro(nombre, apellido, email, pass);
      setReg({ nombre: '', apellido: '', email: '', pass: '', confirmacion: '' });
      setLoginEmail(email.trim());
      setAuthTab('login');
      setAlerta({ texto: 'Cuenta creada correctamente. Ahora puedes iniciar sesión.', tipo: 'success' });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 409 || /ya está registrado|ya existe/i.test(mensaje)) setAlerta({ texto: 'Este correo ya está registrado, intenta con otro.', tipo: 'error' });
      else if (status === 400 || status === 422) setAlerta({ texto: mensaje || 'Los datos del registro no son válidos.', tipo: 'error' });
      else setAlerta({ texto: status === 0 ? mensaje : 'No se pudo completar el registro.', tipo: 'error' });
    } finally {
      setCargando(false);
    }
  };

  const colorBarra = porcentaje < 40 ? colors.error : porcentaje < 80 ? colors.warning : colors.primary;

  return (
    <AppModal visible={authVisible} onClose={cerrarAuth} titulo={authTab === 'recuperar' ? 'Recuperar contraseña' : 'Bienvenido a EV Charge'} anchoMaximo={440}>
      <Aparecer desde="escala" duracion={500} style={{ alignSelf: 'center' }}>
        <Respirar duracion={3500} escala={0.08}>
          <Image source={require('../../assets/images/logo.png')} style={[styles.logo, colors.modo === 'light' && { tintColor: colors.text }]} resizeMode="contain" />
        </Respirar>
      </Aparecer>

      {authTab !== 'recuperar' && (
        <View style={[styles.tabs, { backgroundColor: colors.cardElevated, borderColor: colors.border }]}>
          {(['login', 'registro'] as const).map((tab) => {
            const activa = authTab === tab;
            return (
              <Pressable key={tab} onPress={() => !cargando && cambiarTab(tab)} style={[styles.tab, activa && { backgroundColor: colors.primary }]} accessibilityRole="tab" accessibilityState={{ selected: activa }}>
                <Text style={[styles.tabTexto, { color: activa ? '#fff' : colors.textMuted }]}>{tab === 'login' ? 'Iniciar sesión' : 'Registrarse'}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {alerta && authTab !== 'recuperar' && <Alerta texto={alerta.texto} tipo={alerta.tipo} />}

      {authTab === 'login' && (
        <View>
          <CampoTexto etiqueta="Correo" requerido value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="correo@ejemplo.com" editable={!cargando} />
          <CampoTexto etiqueta="Contraseña" requerido value={loginPass} onChangeText={setLoginPass} password autoCapitalize="none" placeholder="••••••••" editable={!cargando} onSubmitEditing={hacerLogin} returnKeyType="go" />
          <View style={styles.filaEntre}>
            <Casilla marcada={recordarme} onChange={setRecordarme}>Recuérdame</Casilla>
            <Pressable onPress={() => cambiarTab('recuperar')} hitSlop={6}>
              <Text style={[styles.enlace, { color: colors.primary }]}>¿Olvidaste tu contraseña?</Text>
            </Pressable>
          </View>
          {captchaRequerido && <CaptchaSimulado verificado={captchaResuelto} onVerificar={() => setCaptchaResuelto(true)} />}
          <Boton titulo={cargando ? 'Validando credenciales...' : 'Entrar'} cargando={cargando} onPress={hacerLogin} bloque style={{ marginTop: 12 }} />
        </View>
      )}

      {authTab === 'registro' && (
        <View>
          <CampoTexto etiqueta="Nombre" requerido value={reg.nombre} onChangeText={(v) => setReg({ ...reg, nombre: v })} placeholder="Tu nombre" editable={!cargando} />
          <CampoTexto etiqueta="Apellido" requerido value={reg.apellido} onChangeText={(v) => setReg({ ...reg, apellido: v })} placeholder="Tu apellido" editable={!cargando} />
          <CampoTexto etiqueta="Correo" requerido value={reg.email} onChangeText={(v) => setReg({ ...reg, email: v })} keyboardType="email-address" autoCapitalize="none" placeholder="correo@ejemplo.com" editable={!cargando} />
          <CampoTexto etiqueta="Contraseña" requerido value={reg.pass} onChangeText={(v) => setReg({ ...reg, pass: v })} password autoCapitalize="none" placeholder="Crea tu contraseña" editable={!cargando} />
          {reg.pass.length > 0 && (
            <View style={{ marginBottom: 10, gap: 6 }}>
              <View style={[styles.barra, { backgroundColor: colors.border }]}>
                <View style={{ width: `${porcentaje}%`, height: '100%', backgroundColor: colorBarra, borderRadius: 3 }} />
              </View>
              {[...listaRequisitosPassword, ['same', 'Las contraseñas coinciden'] as const].map(([clave, texto]) => {
                const ok = requisitos[clave as keyof typeof requisitos];
                return (
                  <View key={clave} style={styles.requisito}>
                    <Icono name={ok ? 'check' : 'xmark'} size={11} color={ok ? colors.primary : colors.error} />
                    <Text style={{ color: ok ? colors.primary : colors.textDim, fontSize: 12 }}>{texto}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <CampoTexto etiqueta="Confirmar contraseña" requerido value={reg.confirmacion} onChangeText={(v) => setReg({ ...reg, confirmacion: v })} password autoCapitalize="none" placeholder="Repite tu contraseña" contextMenuHidden editable={!cargando} />
          <Boton titulo={cargando ? 'Registrando cuenta...' : 'Crear cuenta'} cargando={cargando} onPress={hacerRegistro} bloque style={{ marginTop: 6 }} />
        </View>
      )}

      {authTab === 'recuperar' && <OlvidarContrasena onVolverAlLogin={() => cambiarTab('login')} />}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  logo: { width: 64, height: 64, alignSelf: 'center', marginBottom: 6 },
  tabs: { flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, padding: 4, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: Radius.sm, alignItems: 'center' },
  tabTexto: { fontWeight: '800', fontSize: 13.5 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  enlace: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  captcha: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderRadius: Radius.sm, marginTop: 12 },
  captchaCaja: { width: 26, height: 26, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  barra: { height: 6, borderRadius: 3, overflow: 'hidden' },
  requisito: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
