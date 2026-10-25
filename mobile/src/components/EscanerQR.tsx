// Lector del QR pegado en el cargador. Usa la cámara (expo-camera, funciona en Expo Go) y
// siempre ofrece escribir el código manual de 10 caracteres por si la cámara no está disponible.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { mensajeError } from '../api/httpClient';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { haptica } from '../utils/haptica';
import { Alerta, AppModal, Boton, CampoTexto, Icono } from './ui';

interface Props {
  visible: boolean;
  titulo: string;
  detalle?: string;
  onCerrar: () => void;
  // Recibe lo que leyó la cámara o lo que escribió el usuario; si lanza error, se muestra aquí.
  onCodigo: (codigo: string) => Promise<void>;
}

export function EscanerQR({ visible, titulo, detalle, onCerrar, onCodigo }: Props) {
  const { colors } = useTheme();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [verManual, setVerManual] = useState(false);
  const [camaraFallo, setCamaraFallo] = useState(false);
  // La cámara dispara muchas lecturas por segundo: solo se atiende una a la vez.
  const ocupado = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setError(''); setManual(''); setProcesando(false); setCamaraFallo(false);
    setVerManual(false);
    ocupado.current = false;
    if (permiso && !permiso.granted && permiso.canAskAgain) void pedirPermiso();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (codigo: string) => {
    if (ocupado.current || !codigo.trim()) return;
    ocupado.current = true;
    setProcesando(true);
    setError('');
    try {
      await onCodigo(codigo.trim());
      haptica.exito();
    } catch (e) {
      haptica.error();
      setError(mensajeError(e, 'No pudimos validar el código. Inténtalo de nuevo.'));
      // Pausa corta antes de volver a leer, para que el usuario alcance a leer el mensaje.
      setTimeout(() => { ocupado.current = false; }, 2500);
    } finally {
      setProcesando(false);
    }
  };

  const alLeer = ({ data }: BarcodeScanningResult) => void enviar(data);

  const sinPermiso = permiso && !permiso.granted;
  const mostrarCamara = visible && permiso?.granted && !camaraFallo;

  return (
    <AppModal visible={visible} onClose={onCerrar} titulo={titulo} anchoMaximo={460}>
      <View style={{ gap: 12 }}>
        {detalle ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>{detalle}</Text> : null}

        <View style={[styles.visor, { borderColor: colors.primaryBorder, backgroundColor: '#000' }]}>
          {mostrarCamara ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={procesando ? undefined : alLeer}
              onMountError={() => setCamaraFallo(true)}
            />
          ) : (
            <View style={styles.centro}>
              <Icono name="camera" size={28} color="#9aa" />
              <Text style={styles.textoVisor}>
                {camaraFallo
                  ? 'No pudimos abrir la cámara. Escribe el código que aparece debajo del QR.'
                  : sinPermiso
                    ? 'Necesitamos permiso para usar la cámara y leer el QR del cargador.'
                    : 'Abriendo la cámara...'}
              </Text>
              {sinPermiso && permiso?.canAskAgain ? <Boton titulo="Permitir cámara" icono="camera" pequeno onPress={() => void pedirPermiso()} /> : null}
            </View>
          )}
          {mostrarCamara ? <View pointerEvents="none" style={[styles.marco, { borderColor: colors.primary }]} /> : null}
          {procesando ? (
            <View style={[StyleSheet.absoluteFill, styles.centro, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
              <Text style={styles.textoVisor}>Validando con EV Charge...</Text>
            </View>
          ) : null}
        </View>

        {error ? <Alerta texto={error} /> : (
          <Text style={{ color: colors.textDim, fontSize: 12, textAlign: 'center' }}>
            Apunta la cámara al QR pegado en el cargador que reservaste.
          </Text>
        )}

        {verManual || camaraFallo || sinPermiso || Platform.OS === 'web' ? (
          <View style={{ gap: 8 }}>
            <CampoTexto
              value={manual}
              onChangeText={setManual}
              placeholder="Código del cargador (ej. K7MPQ-2XRTA)"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Boton titulo="Validar código" icono="unlock" cargando={procesando} disabled={!manual.trim()} onPress={() => void enviar(manual)} bloque />
          </View>
        ) : (
          <Boton titulo="Escribir el código a mano" variante="ghost" pequeno onPress={() => setVerManual(true)} />
        )}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  visor: { height: 280, borderRadius: Radius.lg, borderWidth: 2, overflow: 'hidden' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  textoVisor: { color: '#e6edf3', textAlign: 'center', fontSize: 13 },
  marco: { position: 'absolute', top: '17%', left: '22%', right: '22%', bottom: '17%', borderWidth: 3, borderRadius: Radius.md },
});
