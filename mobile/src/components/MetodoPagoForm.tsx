// Formulario para registrar o editar un método de pago (tarjeta, Nequi, Daviplata o PSE).
// El backend solo conserva los últimos 4 dígitos enmascarados.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { MetodoPago, MetodoPagoCreate } from '../api/metodosPago.api';
import { Alerta, Boton, CampoSelect, CampoTexto } from './ui';

export type MetodoPagoTipo = 'Tarjeta crédito' | 'Tarjeta débito' | 'Nequi' | 'Daviplata' | 'PSE';

export const TIPOS_METODO: MetodoPagoTipo[] = ['Tarjeta crédito', 'Tarjeta débito', 'Nequi', 'Daviplata', 'PSE'];
export const BANCOS_PSE = ['Bancolombia', 'Davivienda', 'Banco de Bogotá', 'BBVA', 'Banco de Occidente', 'Otro banco'];

const tipoNormalizado = (tipo?: string): MetodoPagoTipo =>
  tipo === 'Nequi' || tipo === 'Daviplata' || tipo === 'PSE' || tipo === 'Tarjeta débito' ? tipo : 'Tarjeta crédito';

interface Props {
  initial?: MetodoPago | null;
  onSubmit: (payload: MetodoPagoCreate) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function MetodoPagoForm({ initial, onSubmit, onCancel, submitLabel = 'Guardar método' }: Props) {
  const [tipo, setTipo] = useState<MetodoPagoTipo>(tipoNormalizado(initial?.tipo));
  const [numero, setNumero] = useState(initial?.numero || '');
  const [titular, setTitular] = useState('');
  const [expiracion, setExpiracion] = useState('');
  const [cvv, setCvv] = useState('');
  const [banco, setBanco] = useState(BANCOS_PSE[0]);
  const [documento, setDocumento] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const esTarjeta = tipo.startsWith('Tarjeta');
  const esCelular = tipo === 'Nequi' || tipo === 'Daviplata';

  useEffect(() => {
    setTipo(tipoNormalizado(initial?.tipo));
    setNumero(initial?.numero || '');
  }, [initial]);

  const enviar = async () => {
    setError('');
    const digitos = numero.replace(/\D/g, '');
    const conservaEnmascarado = Boolean(initial && digitos.length <= 4 && /\*/.test(initial.numero));
    if (esTarjeta && !conservaEnmascarado && (digitos.length < 13 || digitos.length > 19 || !titular.trim() || !/^\d{2}\/\d{2}$/.test(expiracion) || !/^\d{3,4}$/.test(cvv))) {
      return setError('Revisa los datos de la tarjeta: titular, número, vencimiento (MM/AA) y CVV.');
    }
    if (esCelular && !conservaEnmascarado && digitos.length !== 10) return setError('El número de celular debe tener 10 dígitos.');
    if (tipo === 'PSE' && !conservaEnmascarado && documento.replace(/\D/g, '').length < 6) return setError('Ingresa un documento válido para PSE.');
    setCargando(true);
    try {
      const valor = tipo === 'PSE' && !conservaEnmascarado ? documento.replace(/\D/g, '') : digitos || numero;
      await onSubmit({ tipo, numero: conservaEnmascarado ? initial!.numero : valor });
      if (!initial) {
        setNumero(''); setTitular(''); setExpiracion(''); setCvv(''); setDocumento('');
      }
    } finally {
      setCargando(false);
    }
  };

  const formatearExpiracion = (valor: string) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 4);
    return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
  };

  return (
    <View>
      {error ? <Alerta texto={error} /> : null}
      <CampoSelect
        etiqueta="Tipo de método"
        valor={tipo}
        opciones={TIPOS_METODO.map((t) => ({ valor: t, etiqueta: t }))}
        onChange={(v) => { setTipo(v as MetodoPagoTipo); setNumero(''); }}
      />
      {esTarjeta && (
        <>
          <CampoTexto etiqueta="Nombre del titular" value={titular} onChangeText={setTitular} placeholder={initial ? 'Dejar vacío para conservar' : 'Como aparece en la tarjeta'} autoComplete="cc-name" />
          <CampoTexto etiqueta="Número de tarjeta" value={numero} onChangeText={(v) => setNumero(v.replace(/[^\d ]/g, '').slice(0, 23))} keyboardType="number-pad" placeholder="4111 1111 1111 1111" autoComplete="cc-number" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <CampoTexto etiqueta="Vencimiento" value={expiracion} onChangeText={(v) => setExpiracion(formatearExpiracion(v))} keyboardType="number-pad" placeholder="MM/AA" maxLength={5} />
            </View>
            <View style={{ flex: 1 }}>
              <CampoTexto etiqueta="CVV" value={cvv} onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" password placeholder="123" maxLength={4} />
            </View>
          </View>
        </>
      )}
      {esCelular && (
        <CampoTexto etiqueta="Número de celular" value={numero} onChangeText={(v) => setNumero(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="3001234567" />
      )}
      {tipo === 'PSE' && (
        <>
          <CampoSelect etiqueta="Banco" valor={banco} opciones={BANCOS_PSE.map((b) => ({ valor: b, etiqueta: b }))} onChange={setBanco} />
          <CampoTexto etiqueta="Documento del titular" value={documento} onChangeText={(v) => setDocumento(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Número de documento" />
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <Boton titulo={cargando ? 'Guardando...' : submitLabel} cargando={cargando} onPress={enviar} />
        {onCancel && <Boton titulo="Cancelar" variante="outline" onPress={onCancel} />}
      </View>
    </View>
  );
}
