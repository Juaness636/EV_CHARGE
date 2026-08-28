import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api/auth';

interface OlvidarContrasenaProps {
  onVolverAlLogin: () => void;
}

export const OlvidarContrasena: React.FC<OlvidarContrasenaProps> = ({ onVolverAlLogin }) => {
  const [paso, setPaso] = useState<number>(1);
  const [email, setEmail] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [resetToken, setResetToken] = useState<string>('');

  const [cargando, setCargando] = useState<boolean>(false);
  const [mensajeError, setMensajeError] = useState<string>('');
  const [mensajeExito, setMensajeExito] = useState<string>('');

  // PASO 1: Enviar Correo
  const handleSolicitarPin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensajeError('');
    setCargando(true);

    try {
      await axios.post(`${API_BASE_URL}/forgot-password`, { email });
      setMensajeExito('Si el correo está registrado, recibirás un PIN de 6 dígitos.');
      setTimeout(() => {
        setMensajeExito('');
        setPaso(2);
      }, 1500);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setMensajeError(error.response?.data?.detail || 'Error al conectar con el servidor.');
      } else {
        setMensajeError('Ocurrió un error inesperado.');
      }
    } finally {
      setCargando(false);
    }
  };

  // PASO 2: Verificar PIN
  const handleVerificarPin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensajeError('');

    if (pin.length !== 6) {
      setMensajeError('El PIN debe ser de 6 dígitos.');
      return;
    }

    setCargando(true);

    try {
      const response = await axios.post<{ reset_token: string }>(`${API_BASE_URL}/verify-pin`, { email, pin });
      setResetToken(response.data.reset_token);
      setMensajeExito('PIN verificado correctamente.');
      setTimeout(() => {
        setMensajeExito('');
        setPaso(3);
      }, 1000);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setMensajeError(error.response?.data?.detail || 'PIN incorrecto o expirado.');
      } else {
        setMensajeError('Ocurrió un error inesperado.');
      }
    } finally {
      setCargando(false);
    }
  };

  // PASO 3: Restablecer Contraseña
  const handleRestablecerPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMensajeError('');

    if (newPassword !== confirmPassword) {
      setMensajeError('Las contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 6) {
      setMensajeError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCargando(true);

    try {
      await axios.post(`${API_BASE_URL}/reset-password`, {
        token: resetToken,
        new_password: newPassword,
      });
      setPaso(4);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setMensajeError(error.response?.data?.detail || 'Error al restablecer la contraseña.');
      } else {
        setMensajeError('Ocurrió un error inesperado.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {paso < 4 && (
          <div style={styles.stepper}>
            <span style={paso >= 1 ? styles.stepActive : styles.step}>1. Correo</span>
            <span style={styles.separator}>&gt;</span>
            <span style={paso >= 2 ? styles.stepActive : styles.step}>2. PIN</span>
            <span style={styles.separator}>&gt;</span>
            <span style={paso >= 3 ? styles.stepActive : styles.step}>3. Contraseña</span>
          </div>
        )}

        {mensajeError && <div style={styles.alertError}>{mensajeError}</div>}
        {mensajeExito && <div style={styles.alertSuccess}>{mensajeExito}</div>}

        {paso === 1 && (
          <form onSubmit={handleSolicitarPin} style={styles.form}>
            <h2 style={styles.title}>¿Olvidaste tu contraseña?</h2>
            <p style={styles.subtitle}>
              Ingresa tu correo registrado para enviarte un código PIN de recuperación.
            </p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Correo Electrónico</label>
              <input
                type="email"
                required
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
              />
            </div>

            <button type="submit" disabled={cargando} style={styles.buttonPrimary}>
              {cargando ? 'Enviando PIN...' : 'Enviar PIN de recuperación'}
            </button>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={handleVerificarPin} style={styles.form}>
            <h2 style={styles.title}>Ingresa el PIN de seguridad</h2>
            <p style={styles.subtitle}>
              Hemos enviado un código a <b>{email}</b>.
            </p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Código PIN (6 dígitos)</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                style={{ ...styles.input, textAlign: 'center', letterSpacing: '8px', fontSize: '20px' }}
              />
            </div>

            <button type="submit" disabled={cargando} style={styles.buttonPrimary}>
              {cargando ? 'Verificando...' : 'Verificar PIN'}
            </button>

            <button
              type="button"
              onClick={() => setPaso(1)}
              style={styles.buttonSecondary}
            >
              Cambiar correo
            </button>
          </form>
        )}

        {paso === 3 && (
          <form onSubmit={handleRestablecerPassword} style={styles.form}>
            <h2 style={styles.title}>Nueva Contraseña</h2>
            <p style={styles.subtitle}>Escribe tu nueva contraseña y confírmala.</p>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Nueva Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Repetir Nueva Contraseña</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
              />
            </div>

            {confirmPassword !== '' && newPassword !== confirmPassword && (
              <p style={{ color: '#e74c3c', fontSize: '12px', margin: '-5px 0 10px 0' }}>
                ⚠️ Las contraseñas no coinciden.
              </p>
            )}

            <button
              type="submit"
              disabled={cargando || Boolean(confirmPassword && newPassword !== confirmPassword)}
              style={
                newPassword && newPassword === confirmPassword
                  ? styles.buttonPrimary
                  : { ...styles.buttonPrimary, opacity: 0.6, cursor: 'not-allowed' }
              }
            >
              {cargando ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
          </form>
        )}

        {paso === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
            <h2 style={styles.title}>¡Contraseña Actualizada!</h2>
            <p style={styles.subtitle}>
              Tu contraseña ha sido cambiada con éxito. Ya puedes iniciar sesión.
            </p>
            <button onClick={onVolverAlLogin} style={styles.buttonPrimary}>
              Ir al Inicio de Sesión
            </button>
          </div>
        )}

        {paso < 4 && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <button onClick={onVolverAlLogin} style={styles.linkButton}>
              ← Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', width: '100%' },
  card: { backgroundColor: 'transparent', width: '100%' },
  stepper: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '16px',
    fontSize: '11px',
    color: '#888888',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '8px',
  },
  step: { color: '#555555' },
  stepActive: { color: '#39a900', fontWeight: 'bold' },
  separator: { color: '#333333' },
  title: { fontSize: '18px', fontWeight: 'bold', color: '#ffffff', marginBottom: '6px' },
  subtitle: { fontSize: '13px', color: '#aaaaaa', marginBottom: '16px', lineHeight: '1.4' },
  form: { display: 'flex', flexDirection: 'column' },
  inputGroup: { marginBottom: '14px', display: 'flex', flexDirection: 'column', textAlign: 'left' },
  label: { fontSize: '12px', fontWeight: '600', color: '#dddddd', marginBottom: '6px' },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: '#39a900',
    color: '#ffffff',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '8px',
    fontSize: '14px',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    color: '#aaaaaa',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '8px',
    fontSize: '12px',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#39a900',
    cursor: 'pointer',
    fontSize: '13px',
    textDecoration: 'underline',
  },
  alertError: {
    backgroundColor: 'rgba(231, 76, 60, 0.15)',
    color: '#e74c3c',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '14px',
    border: '1px solid rgba(231, 76, 60, 0.3)',
  },
  alertSuccess: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    color: '#39a900',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '14px',
    border: '1px solid rgba(57, 169, 0, 0.3)',
  },
};