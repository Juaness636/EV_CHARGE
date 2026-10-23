// Asistente IA flotante (POST /asistente/chat), disponible en todas las pantallas.
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { preguntarAsistente, type MensajeAsistente } from '../api/asistente.api';
import { ApiError } from '../api/httpClient';
import { useTheme } from '../theme/ThemeContext';
import { BREAKPOINT_ESCRITORIO, Radius } from '../theme/spacing';
import { Icono } from './ui';
import { useCapa } from './capas';
import { CapaNotificaciones } from './Notificaciones';
import { Aparecer, PuntosEscribiendo } from './animacion';

const SALUDO = 'Hola, soy el asistente de EV Charge. Puedes preguntarme sobre la plataforma, movilidad eléctrica, estaciones, rutas, reservas o tu cuenta.';
const INICIALES = ['¿Qué cargador sirve para mi vehículo?', '¿Cómo hago una reserva?', '¿Por qué no puedo reservar?'];
const INACTIVIDAD_MS = 120000;

export function AsistenteChat({ elevado = false }: { elevado?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const escritorio = width >= BREAKPOINT_ESCRITORIO;
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [pregunta, setPregunta] = useState('');
  const [mensajes, setMensajes] = useState<MensajeAsistente[]>([{ role: 'assistant', content: SALUDO }]);
  const [sugerencias, setSugerencias] = useState(INICIALES);
  const ultimaActividad = useRef(Date.now());
  const lista = useRef<FlatList<MensajeAsistente>>(null);
  const capa = useCapa(abierto && !escritorio);

  useEffect(() => {
    setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 60);
  }, [mensajes, cargando]);

  // Cierra el chat tras 2 minutos sin actividad, como en el web.
  useEffect(() => {
    if (!abierto) return;
    const timer = setInterval(() => {
      if (Date.now() - ultimaActividad.current >= INACTIVIDAD_MS) {
        setMensajes([{ role: 'assistant', content: 'El chat terminó por inactividad. Puedes volver a escribirme cuando quieras.' }]);
        setSugerencias(INICIALES);
        setPregunta('');
        setAbierto(false);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [abierto]);

  const enviar = async (texto = pregunta) => {
    const limpio = texto.trim();
    if (!limpio || limpio.length > 1000 || cargando) return;
    ultimaActividad.current = Date.now();
    setPregunta('');
    const historialPrevio = mensajes;
    setMensajes([...historialPrevio, { role: 'user', content: limpio }]);
    setCargando(true);
    try {
      const data = await preguntarAsistente(limpio, historialPrevio.slice(-11));
      setMensajes((actual) => [...actual, { role: 'assistant', content: data.respuesta }]);
      setSugerencias(data.sugerencias?.length ? data.sugerencias : INICIALES);
    } catch (error) {
      const mensaje = error instanceof ApiError && error.status === 429
        ? 'Has realizado muchas consultas. Espera un momento y vuelve a intentarlo.'
        : 'No pude conectarme al asistente. Revisa que el backend esté activo e inténtalo de nuevo.';
      setMensajes((actual) => [...actual, { role: 'assistant', content: mensaje }]);
    } finally {
      setCargando(false);
    }
  };

  const panel = (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }, escritorio ? { width: 380, height: Math.min(560, height - 120) } : { flex: 1 }]}>
      <View style={[styles.cabecera, { borderBottomColor: colors.border, backgroundColor: colors.primarySoft }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Icono name="robot" size={16} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>Asistente EV Charge</Text>
          <Text style={{ color: colors.textDim, fontSize: 12 }}>Conversa sobre lo que necesites</Text>
        </View>
        <Pressable onPress={() => setAbierto(false)} hitSlop={10} accessibilityLabel="Cerrar asistente">
          <Icono name="xmark" size={18} color={colors.textDim} />
        </Pressable>
      </View>
      <FlatList
        ref={lista}
        data={mensajes}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        renderItem={({ item }) => (
          <Aparecer duracion={280} desde={item.role === 'user' ? 'escala' : 'izquierda'} style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <View style={[styles.burbuja, { maxWidth: '100%' }, item.role === 'user'
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.cardElevated, borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={{ color: item.role === 'user' ? '#fff' : colors.text, fontSize: 14, lineHeight: 20 }}>{item.content}</Text>
            </View>
          </Aparecer>
        )}
        ListFooterComponent={cargando ? <View style={[styles.burbuja, { backgroundColor: colors.cardElevated, marginTop: 8 }]}><PuntosEscribiendo color={colors.primary} /></View> : null}
      />
      {!cargando && (
        <View style={styles.sugerencias}>
          {sugerencias.slice(0, 3).map((s) => (
            <Pressable key={s} onPress={() => void enviar(s)} style={[styles.sugerencia, { borderColor: colors.primaryBorder }]}>
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={[styles.entrada, { borderTopColor: colors.border, paddingBottom: escritorio ? 10 : Math.max(10, insets.bottom) }]}>
        <TextInput
          value={pregunta}
          onChangeText={(t) => { setPregunta(t); ultimaActividad.current = Date.now(); }}
          placeholder="Escribe tu pregunta..."
          placeholderTextColor={colors.textDim}
          maxLength={1000}
          onSubmitEditing={() => void enviar()}
          returnKeyType="send"
          style={[styles.input, { color: colors.text, backgroundColor: colors.input, borderColor: colors.borderStrong }]}
        />
        <Pressable onPress={() => void enviar()} disabled={!pregunta.trim() || cargando} style={[styles.enviar, { backgroundColor: colors.primary, opacity: !pregunta.trim() || cargando ? 0.5 : 1 }]} accessibilityLabel="Enviar">
          <Icono name="paper-plane" size={15} color="#fff" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <>
      {!abierto && (
        <Pressable
          onPress={() => { setAbierto(true); ultimaActividad.current = Date.now(); }}
          style={[styles.flotante, { backgroundColor: colors.primary, bottom: insets.bottom + (elevado ? 90 : 20) }]}
          accessibilityRole="button"
          accessibilityLabel="Abrir asistente"
        >
          <Icono name="robot" size={22} color="#fff" />
        </Pressable>
      )}
      {abierto && escritorio && <View style={[styles.flotantePanel, { bottom: 20 }]}>{panel}</View>}
      <Modal visible={abierto && !escritorio} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
          {panel}
        </KeyboardAvoidingView>
        <CapaNotificaciones capa={capa} />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flotante: {
    position: 'absolute', right: 18, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, zIndex: 50,
  },
  flotantePanel: { position: 'absolute', right: 20, zIndex: 60, elevation: 12 },
  panel: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 12 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  burbuja: { maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
  sugerencias: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 8 },
  sugerencia: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 6 },
  entrada: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  enviar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
});
