import React, { useEffect, useState } from 'react';
import type { MetodoPagoCreate, MetodoPago } from '../api/metodosPago.api';

export type MetodoPagoTipo = 'Tarjeta crédito' | 'Tarjeta débito' | 'Nequi' | 'Daviplata' | 'PSE';

interface MetodoPagoFormProps {
  initial?: MetodoPago | null;
  onSubmit: (payload: MetodoPagoCreate) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
}

const bancos = ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco de Occidente', 'Otro banco'];
const tipoNormalizado = (tipo?: string): MetodoPagoTipo => tipo === 'Nequi' || tipo === 'Daviplata' || tipo === 'PSE' || tipo === 'Tarjeta débito' ? tipo : 'Tarjeta crédito';

export const MetodoPagoForm: React.FC<MetodoPagoFormProps> = ({ initial, onSubmit, onCancel, submitLabel = 'Guardar método' }) => {
  const optionStyle: React.CSSProperties = { backgroundColor: '#202020', color: '#ffffff' };
  const [tipo, setTipo] = useState<MetodoPagoTipo>(tipoNormalizado(initial?.tipo));
  const [numero, setNumero] = useState(initial?.numero || '');
  const [titular, setTitular] = useState('');
  const [expiracion, setExpiracion] = useState('');
  const [cvv, setCvv] = useState('');
  const [banco, setBanco] = useState(bancos[0]);
  const [documento, setDocumento] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const esTarjeta = tipo.startsWith('Tarjeta');

  useEffect(() => {
    setTipo(tipoNormalizado(initial?.tipo));
    setNumero(initial?.numero || '');
  }, [initial]);

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const digitos = numero.replace(/\D/g, '');
    const contacto = tipo === 'Nequi' || tipo === 'Daviplata';
    const conservaMetodoEnmascarado = Boolean(initial && digitos.length <= 4 && /\*/.test(initial.numero));
    if (esTarjeta && !conservaMetodoEnmascarado && (digitos.length < 13 || digitos.length > 19 || !titular.trim() || !/^\d{2}\/\d{2}$/.test(expiracion) || !/^\d{3,4}$/.test(cvv))) { setError('Revisa los datos de la tarjeta.'); return; }
    if (contacto && !conservaMetodoEnmascarado && digitos.length !== 10) { setError('El número de celular debe tener 10 dígitos.'); return; }
    if (tipo === 'PSE' && !conservaMetodoEnmascarado && documento.replace(/\D/g, '').length < 6) { setError('Ingresa un documento válido para PSE.'); return; }
    setCargando(true);
    try {
      await onSubmit({ tipo, numero: conservaMetodoEnmascarado ? initial!.numero : digitos || numero });
      if (!initial) { setNumero(''); setTitular(''); setExpiracion(''); setCvv(''); setDocumento(''); }
    } finally { setCargando(false); }
  };

  return <form className="admin-form-grid payment-form" onSubmit={enviar}>
    {error && <p className="form-help full-width">{error}</p>}
    <label>Tipo de método<select style={{ colorScheme: 'dark' }} value={tipo} onChange={(e) => { setTipo(e.target.value as MetodoPagoTipo); setNumero(''); }}><option style={optionStyle} value="Tarjeta crédito">Tarjeta de crédito</option><option style={optionStyle} value="Tarjeta débito">Tarjeta débito</option><option style={optionStyle} value="Nequi">Nequi</option><option style={optionStyle} value="Daviplata">Daviplata</option><option style={optionStyle} value="PSE">PSE</option></select></label>
    {esTarjeta && <>
      <label>Nombre del titular<input required={!initial} value={titular} onChange={(e) => setTitular(e.target.value)} placeholder={initial ? 'Dejar vacío para conservar' : 'Como aparece en la tarjeta'} autoComplete="cc-name" /></label>
      <label>Número de tarjeta<input required={!initial} inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value.replace(/[^\d ]/g, '').slice(0, 23))} placeholder="4111 1111 1111 1111" autoComplete="cc-number" /></label>
      <label>Vencimiento (MM/AA)<input required={!initial} inputMode="numeric" value={expiracion} onChange={(e) => setExpiracion(e.target.value.replace(/[^\d/]/g, '').slice(0, 5))} placeholder={initial ? 'Dejar vacío para conservar' : '12/28'} autoComplete="cc-exp" /></label>
      <label>CVV<input required={!initial} type="password" inputMode="numeric" maxLength={4} value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))} placeholder={initial ? 'Dejar vacío para conservar' : '123'} autoComplete="cc-csc" /></label>
    </>}
    {(tipo === 'Nequi' || tipo === 'Daviplata') && <label>Número de celular<input required inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="3001234567" autoComplete="tel" /></label>}
    {tipo === 'PSE' && <><label>Banco<select style={{ colorScheme: 'dark' }} value={banco} onChange={(e) => setBanco(e.target.value)}>{bancos.map((item) => <option style={optionStyle} key={item}>{item}</option>)}</select></label><label>Documento del titular<input required inputMode="numeric" value={documento} onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))} placeholder="Número de documento" /></label></>}
    <div className="full-width payment-form-actions"><button className="btn-form" type="submit" disabled={cargando}>{cargando ? 'Guardando...' : submitLabel}</button>{onCancel && <button type="button" className="btn-tbl" onClick={onCancel}>Cancelar</button>}</div>
  </form>;
};
