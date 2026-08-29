import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

interface ModalPagoProps {
  tipo: 'producto' | 'reserva';
  tituloItem: string;
  monto: number;
  idReferencia?: string; // ID de reserva o ID de producto
  onCerrar: () => void;
  onExito: () => void;
}

export const ModalPago: React.FC<ModalPagoProps> = ({
  tipo,
  tituloItem,
  monto,
  idReferencia,
  onCerrar,
  onExito,
}) => {
  const [metodoPago, setMetodoPago] = useState<'tarjeta' | 'nequi' | 'pse'>('tarjeta');
  const [numeroTarjeta, setNumeroTarjeta] = useState('');
  const [nombreTitular, setNombreTitular] = useState('');
  const [expiracion, setExpiracion] = useState('');
  const [cvv, setCvv] = useState('');
  const [telefonoNequi, setTelefonoNequi] = useState('');

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const handleProcesarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    const token = localStorage.getItem('ev_token');

    try {
      // Simulación o petición a backend
      await axios.post(
        `${API_BASE_URL}/pagos/procesar`,
        {
          tipo_pago: tipo,
          item: tituloItem,
          monto: monto,
          metodo: metodoPago,
          referencia_id: idReferencia || 'PAGO-' + Date.now(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setExito(true);
      setTimeout(() => {
        onExito();
        onCerrar();
      }, 2000);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Error al procesar el pago.');
      } else {
        setError('Ocurrió un error inesperado al realizar el cobro.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.backdrop}>
      <div style={styles.modalCard}>
        <button style={styles.closeBtn} onClick={onCerrar}>✕</button>

        <h2 style={styles.title}>💳 Procesar Pago</h2>
        <p style={styles.subtitle}>
          {tipo === 'producto' ? 'Compra de producto:' : 'Reserva de estación:'}{' '}
          <strong style={{ color: '#ffffff' }}>{tituloItem}</strong>
        </p>

        <div style={styles.montoBox}>
          <span>Total a pagar:</span>
          <span style={styles.montoText}>${monto.toLocaleString('es-CO')} COP</span>
        </div>

        {error && <div style={styles.alertError}>{error}</div>}
        {exito && <div style={styles.alertSuccess}>🎉 ¡Pago aprobado con éxito!</div>}

        {!exito && (
          <form onSubmit={handleProcesarPago} style={styles.form}>
            {/* Selección de Método de Pago */}
            <div style={styles.selectorMetodos}>
              <button
                type="button"
                style={metodoPago === 'tarjeta' ? styles.btnMetodoActive : styles.btnMetodo}
                onClick={() => setMetodoPago('tarjeta')}
              >
                💳 Tarjeta
              </button>
              <button
                type="button"
                style={metodoPago === 'nequi' ? styles.btnMetodoActive : styles.btnMetodo}
                onClick={() => setMetodoPago('nequi')}
              >
                📱 Nequi / PSE
              </button>
            </div>

            {metodoPago === 'tarjeta' && (
              <>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Nombre en la tarjeta</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    value={nombreTitular}
                    onChange={(e) => setNombreTitular(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Número de tarjeta</label>
                  <input
                    type="text"
                    required
                    maxLength={19}
                    placeholder="4500 •••• •••• 0000"
                    value={numeroTarjeta}
                    onChange={(e) => setNumeroTarjeta(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ ...styles.inputGroup, flex: 1 }}>
                    <label style={styles.label}>Expiración (MM/AA)</label>
                    <input
                      type="text"
                      required
                      placeholder="12/28"
                      maxLength={5}
                      value={expiracion}
                      onChange={(e) => setExpiracion(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div style={{ ...styles.inputGroup, flex: 1 }}>
                    <label style={styles.label}>CVV</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
              </>
            )}

            {metodoPago === 'nequi' && (
              <div style={styles.inputGroup}>
                <label style={styles.label}>Número de Celular Nequi</label>
                <input
                  type="text"
                  required
                  placeholder="300 000 0000"
                  maxLength={10}
                  value={telefonoNequi}
                  onChange={(e) => setTelefonoNequi(e.target.value.replace(/\D/g, ''))}
                  style={styles.input}
                />
              </div>
            )}

            <button type="submit" disabled={cargando} style={styles.btnPagar}>
              {cargando ? 'Procesando pago...' : `Pagar $${monto.toLocaleString('es-CO')}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modalCard: {
    backgroundColor: '#18181b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '420px',
    position: 'relative',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '18px',
    cursor: 'pointer',
  },
  title: { color: '#ffffff', fontSize: '20px', marginBottom: '4px' },
  subtitle: { color: '#aaaaaa', fontSize: '13px', marginBottom: '16px' },
  montoBox: {
    backgroundColor: 'rgba(57, 169, 0, 0.1)',
    border: '1px solid rgba(57, 169, 0, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    color: '#dddddd',
    fontSize: '14px',
  },
  montoText: { color: '#39a900', fontSize: '18px', fontWeight: 'bold' },
  form: { display: 'flex', flexDirection: 'column' },
  selectorMetodos: { display: 'flex', gap: '8px', marginBottom: '16px' },
  btnMetodo: {
    flex: 1,
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '12px',
  },
  btnMetodoActive: {
    flex: 1,
    padding: '8px',
    borderRadius: '6px',
    border: '1px solid #39a900',
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    color: '#ffffff',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px',
  },
  inputGroup: { marginBottom: '12px', display: 'flex', flexDirection: 'column' },
  label: { fontSize: '12px', color: '#ccc', marginBottom: '4px' },
  input: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none',
  },
  btnPagar: {
    backgroundColor: '#39a900',
    color: '#ffffff',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '10px',
  },
  alertError: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    color: '#e74c3c',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  alertSuccess: {
    backgroundColor: 'rgba(57, 169, 0, 0.2)',
    color: '#39a900',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '14px',
    textAlign: 'center',
    fontWeight: 'bold',
  },
};