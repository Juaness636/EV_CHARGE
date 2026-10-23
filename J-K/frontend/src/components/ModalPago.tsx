import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { crearMetodoPago, type MetodoPago } from '../api/metodosPago.api';
import { API_BASE_URL } from '../api/httpClient';
import { useAuth } from '../context/AuthContext';

interface ModalPagoProps {
  tipo: 'producto' | 'reserva';
  tituloItem: string;
  // En productos es el precio unitario; el total se multiplica por la cantidad elegida.
  monto: number;
  idReferencia?: string; // ID de reserva o ID de producto
  onCerrar: () => void;
  onExito: (pago: { transaccion_id: string }) => void | Promise<void>;
  metodosGuardados?: MetodoPago[];
}

export const ModalPago: React.FC<ModalPagoProps> = ({
  tipo,
  tituloItem,
  monto,
  idReferencia,
  onCerrar,
  onExito,
  metodosGuardados = [],
}) => {
  const optionStyle: React.CSSProperties = { backgroundColor: '#18181b', color: '#ffffff' };
  const [metodoPago, setMetodoPago] = useState('Tarjeta crédito');
  const [modoPago, setModoPago] = useState<'guardado' | 'nuevo'>(metodosGuardados.length ? 'guardado' : 'nuevo');
  const [numeroTarjeta, setNumeroTarjeta] = useState('');
  const [nombreTitular, setNombreTitular] = useState('');
  const [expiracion, setExpiracion] = useState('');
  const [cvv, setCvv] = useState('');
  const [telefonoNequi, setTelefonoNequi] = useState('');
  const [bancoPse, setBancoPse] = useState('Bancolombia');
  const [documentoPse, setDocumentoPse] = useState('');
  const [guardarMetodo, setGuardarMetodo] = useState(false);
  const [metodoGuardadoId, setMetodoGuardadoId] = useState(metodosGuardados[0]?.id || '');

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const metodosDisponibles = metodosGuardados.filter((metodo) => metodo.estado !== false);
  const { usuario } = useAuth();
  const esProducto = tipo === 'producto';
  const [cantidad, setCantidad] = useState(1);
  // Datos de contacto y envío que recibe el administrador para gestionar el pedido.
  const [envio, setEnvio] = useState({
    contacto_nombre: [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' '),
    contacto_telefono: '',
    direccion_envio: '',
    ciudad: '',
    notas_cliente: '',
  });
  const total = esProducto ? monto * cantidad : monto;

  useEffect(() => {
    setMetodoGuardadoId(metodosDisponibles[0]?.id || '');
    setModoPago(metodosDisponibles.length ? 'guardado' : 'nuevo');
  }, [metodosGuardados]);

  const esTarjeta = metodoPago.startsWith('Tarjeta');
  const esNequi = metodoPago === 'Nequi';
  const esDaviplata = metodoPago === 'Daviplata';
  const esPse = metodoPago === 'PSE';

  const handleProcesarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    const token = localStorage.getItem('ev_token');

    try {
      if (esProducto) {
        if (envio.contacto_nombre.trim().length < 3) { setError('Escribe el nombre de quien recibe el pedido.'); return; }
        if (!/^\+?\d{7,15}$/.test(envio.contacto_telefono)) { setError('Escribe un teléfono de contacto válido (7 a 15 dígitos).'); return; }
        if (envio.direccion_envio.trim().length < 5) { setError('Escribe la dirección de envío completa.'); return; }
        if (envio.ciudad.trim().length < 2) { setError('Escribe la ciudad de entrega.'); return; }
      }
      const metodoGuardado = modoPago === 'guardado' ? metodosDisponibles.find((metodo) => metodo.id === metodoGuardadoId) : undefined;
      if (modoPago === 'guardado' && !metodoGuardado) { setError('Selecciona un método registrado o agrega uno nuevo.'); return; }
      if (modoPago === 'nuevo' && esTarjeta && (numeroTarjeta.replace(/\D/g, '').length < 13 || !/^\d{2}\/\d{2}$/.test(expiracion) || !/^\d{3,4}$/.test(cvv))) { setError('Revisa el número, vencimiento y CVV de la tarjeta.'); return; }
      if (modoPago === 'nuevo' && (esNequi || esDaviplata) && telefonoNequi.length !== 10) { setError('El número de celular debe tener 10 dígitos.'); return; }
      if (modoPago === 'nuevo' && esPse && documentoPse.length < 6) { setError('Ingresa un documento válido para PSE.'); return; }
      let metodoNuevoId: string | undefined;
      if (modoPago === 'nuevo' && guardarMetodo) {
        const numeroNuevo = esTarjeta ? numeroTarjeta : esNequi || esDaviplata ? telefonoNequi : documentoPse;
        const nuevo = await crearMetodoPago({ tipo: metodoPago, numero: numeroNuevo, estado: true });
        metodoNuevoId = nuevo.id;
      }
      // Simulación o petición a backend
      const { data: pago } = await axios.post<{ transaccion_id: string }>(
        `${API_BASE_URL}/api/pagos/procesar`,
        {
          tipo_pago: tipo,
          item: tituloItem,
          monto: total,
          metodo: metodoGuardado?.tipo || metodoPago,
          metodo_id: metodoGuardado?.id || metodoNuevoId,
          referencia_id: idReferencia || 'PAGO-' + Date.now(),
          ...(esProducto ? { cantidad, envio: { ...envio, notas_cliente: envio.notas_cliente.trim() || undefined } } : {}),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setExito(true);
      setTimeout(async () => {
        await onExito(pago);
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
          <span style={styles.montoText}>${total.toLocaleString('es-CO')} COP</span>
        </div>

        {error && <div style={styles.alertError}>{error}</div>}
        {exito && <div style={styles.alertSuccess}>🎉 ¡Pago aprobado con éxito!{esProducto && ' Te contactaremos para coordinar el envío; sigue tu pedido en Mis compras.'}</div>}

        {!exito && (
          <form onSubmit={handleProcesarPago} style={styles.form}>
            {esProducto && (
              <>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Cantidad (${monto.toLocaleString('es-CO')} c/u)</label>
                  <input type="number" min={1} max={10} value={cantidad} onChange={(e) => setCantidad(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} style={styles.input} />
                </div>
                <div style={styles.inputGroup}><label style={styles.label}>Nombre de quien recibe</label><input required value={envio.contacto_nombre} onChange={(e) => setEnvio({ ...envio, contacto_nombre: e.target.value })} placeholder="Ej. Juan Pérez" style={styles.input} /></div>
                <div style={styles.inputGroup}><label style={styles.label}>Teléfono de contacto</label><input required inputMode="tel" value={envio.contacto_telefono} onChange={(e) => setEnvio({ ...envio, contacto_telefono: e.target.value.replace(/[^\d+]/g, '').slice(0, 16) })} placeholder="300 000 0000" style={styles.input} /></div>
                <div style={styles.inputGroup}><label style={styles.label}>Dirección de envío</label><input required value={envio.direccion_envio} onChange={(e) => setEnvio({ ...envio, direccion_envio: e.target.value })} placeholder="Calle 00 # 00-00, apto, barrio" style={styles.input} /></div>
                <div style={styles.inputGroup}><label style={styles.label}>Ciudad</label><input required value={envio.ciudad} onChange={(e) => setEnvio({ ...envio, ciudad: e.target.value })} placeholder="Ej. Bogotá" style={styles.input} /></div>
                <div style={styles.inputGroup}><label style={styles.label}>Indicaciones (opcional)</label><textarea rows={2} maxLength={500} value={envio.notas_cliente} onChange={(e) => setEnvio({ ...envio, notas_cliente: e.target.value })} placeholder="Horario de entrega, referencias..." style={styles.input} /></div>
              </>
            )}
            <div style={styles.paymentModeSwitch}><button type="button" style={modoPago === 'guardado' ? styles.modeActive : styles.modeButton} onClick={() => setModoPago('guardado')} disabled={!metodosDisponibles.length}>Usar método registrado</button><button type="button" style={modoPago === 'nuevo' ? styles.modeActive : styles.modeButton} onClick={() => setModoPago('nuevo')}>Agregar método</button></div>
            {modoPago === 'guardado' ? <div style={styles.inputGroup}><label style={styles.label}>Método registrado</label><select required value={metodoGuardadoId} onChange={(e) => setMetodoGuardadoId(e.target.value)} style={{ ...styles.input, colorScheme: 'dark' }}><option value="" style={optionStyle}>Selecciona un método</option>{metodosDisponibles.map((metodo) => <option key={metodo.id} value={metodo.id} style={optionStyle}>{metodo.tipo} · termina en {metodo.numero.slice(-4)}</option>)}</select></div> : <div style={styles.inputGroup}><label style={styles.label}>Tipo de método</label><select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} style={{ ...styles.input, colorScheme: 'dark' }}><option style={optionStyle}>Tarjeta crédito</option><option style={optionStyle}>Tarjeta débito</option><option style={optionStyle}>Nequi</option><option style={optionStyle}>Daviplata</option><option style={optionStyle}>PSE</option></select></div>}

            {modoPago === 'nuevo' && esTarjeta && (
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
                    onChange={(e) => setNumeroTarjeta(e.target.value.replace(/[^\d ]/g, '').slice(0, 23))}
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

            {modoPago === 'nuevo' && esNequi && (
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

            {modoPago === 'nuevo' && esDaviplata && <div style={styles.inputGroup}><label style={styles.label}>Número de celular Daviplata</label><input type="text" required inputMode="numeric" maxLength={10} placeholder="300 000 0000" value={telefonoNequi} onChange={(e) => setTelefonoNequi(e.target.value.replace(/\D/g, ''))} style={styles.input} /></div>}
            {modoPago === 'nuevo' && esPse && <><div style={styles.inputGroup}><label style={styles.label}>Banco</label><select value={bancoPse} onChange={(e) => setBancoPse(e.target.value)} style={{ ...styles.input, colorScheme: 'dark' }}><option>Bancolombia</option><option>Davivienda</option><option>Banco de Bogotá</option><option>BBVA</option><option>Banco de Occidente</option><option>Otro banco</option></select></div><div style={styles.inputGroup}><label style={styles.label}>Documento del titular</label><input required inputMode="numeric" value={documentoPse} onChange={(e) => setDocumentoPse(e.target.value.replace(/\D/g, ''))} placeholder="Número de documento" style={styles.input} /></div></>}
            {modoPago === 'nuevo' && <label style={styles.saveMethod}><input type="checkbox" checked={guardarMetodo} onChange={(e) => setGuardarMetodo(e.target.checked)} /> Guardar este método para futuras reservas</label>}

            <button type="submit" disabled={cargando} style={styles.btnPagar}>
              {cargando ? 'Procesando pago...' : `Pagar $${total.toLocaleString('es-CO')}`}
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
  paymentModeSwitch: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' },
  modeButton: { padding: '10px 8px', borderRadius: '7px', border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.04)', color: '#aaa', cursor: 'pointer', fontSize: '12px' },
  modeActive: { padding: '10px 8px', borderRadius: '7px', border: '1px solid #39a900', background: 'rgba(57,169,0,.16)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700 },
  saveMethod: { display: 'flex', alignItems: 'center', gap: '8px', color: '#bbb', fontSize: '12px', margin: '3px 0 8px' },
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
