// QR de cada cargador de una estación, para imprimirlos y pegarlos en la estación.
// Lo usan el admin (cualquier estación) y la empresa (solo las suyas; lo valida el backend).
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { abrirHojaQr, qrEstacion, type QrEstacion } from '../api/qr.api';
import { mensajeError } from '../api/httpClient';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { Alerta, AppModal, Boton, Cargando, Vacio } from './ui';
import { notificar } from './Notificaciones';

interface Props {
  estacion: { id: string; nombre: string } | null;
  como: 'admin' | 'empresa';
  onCerrar: () => void;
}

export function ModalQrCargadores({ estacion, como, onCerrar }: Props) {
  const { colors } = useTheme();
  const [datos, setDatos] = useState<QrEstacion | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!estacion) return;
    let cancelado = false;
    setDatos(null);
    setError('');
    qrEstacion(estacion.id, como)
      .then((d) => !cancelado && setDatos(d))
      .catch((e) => !cancelado && setError(mensajeError(e, 'No se pudieron generar los QR de esta estación.')));
    return () => { cancelado = true; };
  }, [estacion, como]);

  const imprimir = async () => {
    if (!estacion) return;
    try {
      // Se pide de nuevo para que el permiso de la hoja (15 min) esté recién creado.
      const actual = await qrEstacion(estacion.id, como);
      await abrirHojaQr(actual.hoja_url);
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'QR de cargadores', mensaje: mensajeError(e, 'No se pudo abrir la hoja para imprimir.') });
    }
  };

  return (
    <AppModal
      visible={!!estacion}
      onClose={onCerrar}
      titulo={estacion ? `QR de cargadores · ${estacion.nombre}` : 'QR de cargadores'}
      anchoMaximo={640}
      pie={datos && datos.cargadores.length > 0
        ? <Boton titulo="Imprimir o guardar PDF" icono="print" onPress={() => void imprimir()} bloque />
        : undefined}
    >
      <View style={{ gap: 12 }}>
        <Alerta
          tipo="info"
          texto="Cada cargador tiene su propio QR. Pégalo en el cargador: el conductor lo escanea al llegar y solo se desbloquea el cargador que reservó."
        />
        {error ? <Alerta texto={error} /> : null}
        {!datos && !error ? <Cargando texto="Generando QR..." /> : null}
        {datos && datos.cargadores.length === 0 ? <Vacio texto="Esta estación no tiene cargadores registrados." icono="plug" /> : null}
        <View style={styles.rejilla}>
          {datos?.cargadores.map((c) => (
            <View key={c.referencia} style={[styles.tarjeta, { borderColor: colors.primaryBorder, backgroundColor: colors.cardElevated }]}>
              <Text style={[styles.titulo, { color: colors.text }]}>Cargador #{c.numero}</Text>
              <Text style={{ color: colors.textDim, fontSize: 12 }} numberOfLines={1}>
                {[c.tipo, c.potencia_kw ? `${c.potencia_kw} kW` : ''].filter(Boolean).join(' · ') || 'Conector'}
              </Text>
              <View style={styles.marcoQr}>
                <Image source={{ uri: c.imagen }} style={styles.qr} contentFit="contain" accessibilityLabel={`QR del cargador ${c.numero}`} />
              </View>
              <Text style={[styles.codigo, { color: colors.text }]} selectable>{c.codigo}</Text>
              <Text style={{ color: colors.textDim, fontSize: 11 }}>Código manual</Text>
            </View>
          ))}
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  tarjeta: { width: 180, borderWidth: 1.5, borderRadius: Radius.lg, padding: 12, alignItems: 'center', gap: 4 },
  titulo: { fontSize: 16, fontWeight: '800' },
  // Fondo blanco siempre: un QR sobre fondo oscuro cuesta más leerlo.
  marcoQr: { backgroundColor: '#ffffff', borderRadius: Radius.md, padding: 6, marginTop: 6 },
  qr: { width: 140, height: 140 },
  codigo: { fontSize: 15, fontWeight: '800', letterSpacing: 1.5, fontFamily: 'monospace', marginTop: 4 },
});
