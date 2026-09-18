// Modal Nativo de Autenticación (Login / Registro) para EV Charge Móvil
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  visible: boolean;
  initialTab?: 'login' | 'registro';
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  initialTab = 'login',
  onClose,
  onSuccess,
}) => {
  const { login, registro } = useAuth();
  const [tab, setTab] = useState<'login' | 'registro'>(initialTab);

  // Estados de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Estados de Registro
  const [regNombre, setRegNombre] = useState('');
  const [regApellido, setRegApellido] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConfirm, setRegPassConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  // Control de carga y alertas
  const [cargando, setCargando] = useState(false);
  const [alerta, setAlerta] = useState<{ tipo: 'error' | 'success'; mensaje: string } | null>(null);

  // Validación de requisitos de contraseña
  const passwordReqs = useMemo(() => ({
    min: regPass.length >= 8,
    may: /[A-Z]/.test(regPass),
    low: /[a-z]/.test(regPass),
    num: /\d/.test(regPass),
    sim: /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(regPass),
    same: regPass === regPassConfirm && regPass !== '',
  }), [regPass, regPassConfirm]);

  const passwordComplete = Object.values(passwordReqs).every(Boolean);

  const handleLogin = async () => {
    const email = loginEmail.trim();
    const pass = loginPass;

    if (!email || !pass) {
      setAlerta({ tipo: 'error', mensaje: 'Por favor, completa el correo y la contraseña.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAlerta({ tipo: 'error', mensaje: 'Ingresa un correo electrónico válido.' });
      return;
    }

    setCargando(true);
    setAlerta(null);

    try {
      await login(email, pass);
      setAlerta({ tipo: 'success', mensaje: 'Sesión iniciada correctamente.' });
      onSuccess?.();
      onClose();
    } catch (error: any) {
      setAlerta({
        tipo: 'error',
        mensaje: error?.message || 'Credenciales incorrectas o backend no disponible.',
      });
    } finally {
      setCargando(false);
    }
  };

  const handleRegistro = async () => {
    const nombre = regNombre.trim();
    const apellido = regApellido.trim();
    const email = regEmail.trim();
    const pass = regPass;

    if (!nombre || !apellido || !email || !pass || !regPassConfirm) {
      setAlerta({ tipo: 'error', mensaje: 'Por favor, completa todos los campos.' });
      return;
    }

    if (!passwordComplete) {
      setAlerta({ tipo: 'error', mensaje: 'La contraseña no cumple todos los requisitos.' });
      return;
    }

    setCargando(true);
    setAlerta(null);

    try {
      await registro(nombre, apellido, email, pass);
      setAlerta({ tipo: 'success', mensaje: 'Cuenta creada con éxito. Ya puedes iniciar sesión.' });
      setTab('login');
      setLoginEmail(email);
    } catch (error: any) {
      setAlerta({
        tipo: 'error',
        mensaje: error?.message || 'No se pudo crear la cuenta. Intente de nuevo.',
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Header del modal */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                EV <Text style={styles.accentText}>CHARGE</Text>
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <FontAwesome6 name="xmark" size={18} color={Colors.textDim} />
              </TouchableOpacity>
            </View>

            {/* Selector de Pestañas */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
                onPress={() => {
                  setTab('login');
                  setAlerta(null);
                }}
              >
                <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
                  Iniciar sesión
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, tab === 'registro' && styles.tabBtnActive]}
                onPress={() => {
                  setTab('registro');
                  setAlerta(null);
                }}
              >
                <Text style={[styles.tabText, tab === 'registro' && styles.tabTextActive]}>
                  Registrarse
                </Text>
              </TouchableOpacity>
            </View>

            {/* Alerta */}
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
                  {alerta.mensaje}
                </Text>
              </View>
            )}

            {/* Formulario de Login */}
            {tab === 'login' ? (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.label}>Correo electrónico</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="usuario@ejemplo.com"
                    placeholderTextColor={Colors.textDim}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Contraseña</Text>
                  <View style={styles.passWrapper}>
                    <TextInput
                      style={[styles.input, styles.passInput]}
                      placeholder="Tu contraseña"
                      placeholderTextColor={Colors.textDim}
                      secureTextEntry={!showLoginPass}
                      value={loginPass}
                      onChangeText={setLoginPass}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowLoginPass(!showLoginPass)}
                    >
                      <FontAwesome6
                        name={showLoginPass ? 'eye-slash' : 'eye'}
                        size={15}
                        color={Colors.textDim}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, cargando && styles.btnDisabled]}
                  onPress={handleLogin}
                  disabled={cargando}
                  activeOpacity={0.85}
                >
                  {cargando ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Entrar a EV Charge</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* Formulario de Registro */
              <View style={styles.form}>
                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Nombre</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Nombre"
                      placeholderTextColor={Colors.textDim}
                      value={regNombre}
                      onChangeText={setRegNombre}
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.label}>Apellido</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Apellido"
                      placeholderTextColor={Colors.textDim}
                      value={regApellido}
                      onChangeText={setRegApellido}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Correo electrónico</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="usuario@ejemplo.com"
                    placeholderTextColor={Colors.textDim}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={regEmail}
                    onChangeText={setRegEmail}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Contraseña</Text>
                  <View style={styles.passWrapper}>
                    <TextInput
                      style={[styles.input, styles.passInput]}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor={Colors.textDim}
                      secureTextEntry={!showRegPass}
                      value={regPass}
                      onChangeText={setRegPass}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowRegPass(!showRegPass)}
                    >
                      <FontAwesome6
                        name={showRegPass ? 'eye-slash' : 'eye'}
                        size={15}
                        color={Colors.textDim}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirmar contraseña</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Repite tu contraseña"
                    placeholderTextColor={Colors.textDim}
                    secureTextEntry={!showRegPass}
                    value={regPassConfirm}
                    onChangeText={setRegPassConfirm}
                  />
                </View>

                {/* Requisitos de seguridad */}
                <View style={styles.reqList}>
                  {[
                    ['min', 'Mínimo 8 caracteres'],
                    ['may', 'Una mayúscula'],
                    ['low', 'Una minúscula'],
                    ['num', 'Un número'],
                    ['sim', 'Un símbolo especial'],
                    ['same', 'Las contraseñas coinciden'],
                  ].map(([key, desc]) => {
                    const valid = passwordReqs[key as keyof typeof passwordReqs];
                    return (
                      <View key={key} style={styles.reqItem}>
                        <FontAwesome6
                          name={valid ? 'check' : 'xmark'}
                          size={11}
                          color={valid ? Colors.success : Colors.textDim}
                        />
                        <Text
                          style={[
                            styles.reqText,
                            valid ? styles.reqValid : styles.reqInvalid,
                          ]}
                        >
                          {desc}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, cargando && styles.btnDisabled]}
                  onPress={handleRegistro}
                  disabled={cargando}
                  activeOpacity={0.85}
                >
                  {cargando ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Crear cuenta</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  cardContainer: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderGreen,
    maxHeight: '90%',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },
  accentText: {
    color: Colors.greenEv,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabBtnActive: {
    backgroundColor: Colors.greenEv,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: Colors.white,
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
  form: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  field: {
    marginBottom: 4,
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
  passWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passInput: {
    paddingRight: 40,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  reqList: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: 4,
    marginVertical: 4,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reqText: {
    fontSize: 11,
  },
  reqValid: {
    color: Colors.success,
  },
  reqInvalid: {
    color: Colors.textDim,
  },
  submitBtn: {
    backgroundColor: Colors.greenEv,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
});
