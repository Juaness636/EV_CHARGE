// Modal de pago simulado para productos y reservas (POST /api/pagos/procesar).
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { crearMetodoPago, type MetodoPago } from '../api/metodosPago.api';
import { procesarPago } from '../api/pagos.api';
import { mensajeError } from '../api/httpClient';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { pesos } from '../utils/formato';
import { BANCOS_PSE, TIPOS_METODO, type MetodoPagoTipo } from './MetodoPagoForm';
import { CheckAnimado } from './animacion';
import { haptica } from '../utils/haptica';
import { Alerta, AppModal, Boton, CampoSelect, CampoTexto, Casilla, Chips, Icono } from './ui';

interface Props {
  visible: boolean;
  tipo: 'producto' | 'reserva';
  tituloItem: string;
  monto: number;
  idReferencia?: string;
  metodosGuardados?: MetodoPago[];
  onCerrar: () => void;
  onExito: () => void | Promise<void>;
}

export function ModalPago({ visible, tipo, tituloItem, monto, idReferencia, metodosGuardados = [], onCerrar, onExito }: Props) {
  const { colors } = useTheme();
  const disponibles = useMemo(() => metodosGuardados.filter((m) => m.estado !== false), [metodosGuardados]);
  const [modo, setModo] = useState<'guardado' | 'nuevo'>(disponibles.length ? 'guardado' : 'nuevo');
  const [metodoGuardadoId, setMetodoGuardadoId] = useState(disponibles[0]?.id || '');
  const [metodo, setMetodo] = useState<MetodoPagoTipo>('Tarjeta crédito');
  const [numeroTarjeta, setNumeroTarjeta] = useState('');
  const [titular, setTitular] = useState('');
  const [expiracion, setExpiracion] = useState('');
  const [cvv, setCvv] = useState('');
  const [celular, setCelular] = useState('');
  const [banco, setBanco] = useState(BANCOS_PSE[0]);
  const [documento, setDocumento] = useState('');
  const [guardarMetodo, setGuardarMetodo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setModo(disponibles.length ? 'guardado' : 'nuevo');
    setMetodoGuardadoId(disponibles[0]?.id || '');
    setError('');
    setExito(false);
    setCvv('');
  }, [visible, disponibles]);

  const esTarjeta = metodo.startsWith('Tarjeta');
  const esCelular = metodo === 'Nequi' || metodo === 'Daviplata';

  const pagar = async () => {
    setError('');
    const guardado = modo === 'guardado' ? disponibles.find((m) => m.id === metodoGuardadoId) : undefined;
    if (modo === 'guardado' && !guardado) return setError('Selecciona un método registrado o agrega uno nuevo.');
    if (modo === 'nuevo' && esTarjeta && (numeroTarjeta.replace(/\D/g, '').length < 13 || !titular.trim() || !/^\d{2}\/\d{2}$/.test(expiracion) || !/^\d{3,4}$/.test(cvv))) {
      return setError('Revisa el titular, número, vencimiento y CVV de la tarjeta.');
    }
    if (modo === 'nuevo' && esCelular && celular.length !== 10) return setError('El número de celular debe tener 10 dígitos.');
    if (modo === 'nuevo' && metodo === 'PSE' && documento.length < 6) return setError('Ingresa un documento válido para PSE.');

    setCargando(true);
    try {
      let metodoNuevoId: string | undefined;
      if (modo === 'nuevo' && guardarMetodo) {
        const numero = esTarjeta ? numeroTarjeta.replace(/\D/g, '') : esCelular ? celular : documento;
        metodoNuevoId = (await crearMetodoPago({ tipo: metodo, numero, estado: true })).id;
      }
      await procesarPago({
        tipo_pago: tipo,
        item: tituloItem,
        monto,
        metodo: guardado?.tipo || metodo,
        metodo_id: guardado?.id || metodoNuevoId,
        referencia_id: idReferencia || `PAGO-${Date.now()}`,
      });
      setExito(true);
      haptica.exito();
      setTimeout(async () => {
        await onExito();
        onCerrar();
      }, 1500);
    } catch (e) {
      setError(mensajeError(e, 'Error al procesar el pago.'));
    } finally {
      setCargando(false);
    }
  };

  const formatearExpiracion = (valor: string) => {
    const d = valor.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  return (
    <AppModal visible={visible} onClose={cargando ? () => undefined : onCerrar} titulo="Procesar pago" anchoMaximo={460}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        {tipo === 'producto' ? 'Compra de producto: ' : 'Reserva de estación: '}
        <Text style={{ color: colors.text, fontWeight: '800' }}>{tituloItem}</Text>
      </Text>
      <View style={[styles.monto, { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder }]}>
        <Text style={{ color: colors.textMuted }}>Total a pagar</Text>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '900' }}>{pesos(monto)}</Text>
      </View>

      {error ? <Alerta texto={error} /> : null}

      {exito ? (
        <View style={styles.exito}>
          <CheckAnimado tamano={64} />
          <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 16 }}>¡Pago aprobado con éxito!</Text>
        </View>
      ) : (
        <>
          <Chips
            valor={modo}
            onChange={(v) => setModo(v)}
            opciones={[
              ...(disponibles.length ? [{ valor: 'guardado' as const, etiqueta: 'Usar método registrado', icono: 'wallet' }] : []),
              { valor: 'nuevo' as const, etiqueta: 'Agregar método', icono: 'plus' },
            ]}
          />
          {modo === 'guardado' ? (
            <CampoSelect
              etiqueta="Método registrado"
              valor={metodoGuardadoId}
              onChange={setMetodoGuardadoId}
              opciones={disponibles.map((m) => ({ valor: m.id, etiqueta: `${m.tipo} · termina en ${m.numero.slice(-4)}` }))}
            />
          ) : (
            <>
              <CampoSelect etiqueta="Tipo de método" valor={metodo} onChange={(v) => setMetodo(v as MetodoPagoTipo)} opciones={TIPOS_METODO.map((t) => ({ valor: t, etiqueta: t }))} />
              {esTarjeta && (
                <>
                  <CampoTexto etiqueta="Nombre en la tarjeta" value={titular} onChangeText={setTitular} placeholder="Ej. Juan Pérez" />
                  <CampoTexto etiqueta="Número de tarjeta" value={numeroTarjeta} onChangeText={(v) => setNumeroTarjeta(v.replace(/[^\d ]/g, '').slice(0, 23))} keyboardType="number-pad" placeholder="4500 •••• •••• 0000" />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><CampoTexto etiqueta="Expiración" value={expiracion} onChangeText={(v) => setExpiracion(formatearExpiracion(v))} keyboardType="number-pad" placeholder="MM/AA" maxLength={5} /></View>
                    <View style={{ flex: 1 }}><CampoTexto etiqueta="CVV" value={cvv} onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" password placeholder="•••" maxLength={4} /></View>
                  </View>
                </>
              )}
              {esCelular && <CampoTexto etiqueta={`Número de celular ${metodo}`} value={celular} onChangeText={(v) => setCelular(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="300 000 0000" />}
              {metodo === 'PSE' && (
                <>
                  <CampoSelect etiqueta="Banco" valor={banco} onChange={setBanco} opciones={BANCOS_PSE.map((b) => ({ valor: b, etiqueta: b }))} />
                  <CampoTexto etiqueta="Documento del titular" value={documento} onChangeText={(v) => setDocumento(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Número de documento" />
                </>
              )}
              <Casilla marcada={guardarMetodo} onChange={setGuardarMetodo}>Guardar este método para futuras compras y reservas</Casilla>
            </>
          )}
          <Boton titulo={cargando ? 'Procesando pago...' : `Pagar ${pesos(monto)}`} icono="lock" cargando={cargando} onPress={pagar} bloque style={{ marginTop: 8 }} />
          <Text style={{ color: colors.textDim, fontSize: 11.5, textAlign: 'center' }}>Pago simulado con fines académicos. No se realizan cobros reales.</Text>
        </>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  monto: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: Radius.md, borderWidth: 1, marginVertical: 6 },
  exito: { alignItems: 'center', gap: 10, paddingVertical: 24 },
});
