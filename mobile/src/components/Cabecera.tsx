// Piezas de cabecera compartidas: logo, selector de tema y campana de notificaciones.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { eliminarNotificacion, listarNotificaciones, marcarNotificacionesLeidas, type Notificacion } from '../api/notificaciones.api';
import { useAuth } from '../context/AuthContext';
import { useTheme, type ThemeMode } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { escuchar } from '../utils/eventos';
import { tiempoRelativo } from '../utils/formato';
import { iconoNotificacion, notificar } from './Notificaciones';
import { AppModal, Icono, Vacio } from './ui';

export function Logo({ mostrarNombre = true, onPress }: { mostrarNombre?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable onPress={onPress ?? (() => router.navigate('/'))} style={styles.logo} accessibilityRole="link" accessibilityLabel="Ir al inicio de EV Charge">
      <Image source={require('../../assets/images/logo.png')} style={styles.logoImg} resizeMode="contain" />
      {mostrarNombre && <Text style={[styles.logoTexto, { color: colors.text }]}>EV CHARGE</Text>}
    </Pressable>
  );
}

export function SelectorTema({ compacto = false }: { compacto?: boolean }) {
  const { colors, mode, setMode } = useTheme();
  const opciones: Array<{ modo: ThemeMode; icono: string; etiqueta: string }> = [
    { modo: 'dark', icono: 'moon', etiqueta: 'Modo oscuro' },
    { modo: 'light', icono: 'sun', etiqueta: 'Modo claro' },
    { modo: 'system', icono: 'circle-half-stroke', etiqueta: 'Tema del sistema' },
  ];
  return (
    <View style={[styles.tema, { borderColor: colors.border, backgroundColor: colors.cardElevated }]}>
      {opciones.map((o) => {
        const activo = mode === o.modo;
        return (
          <Pressable key={o.modo} onPress={() => setMode(o.modo)} style={[styles.temaBoton, compacto && styles.temaBotonCompacto, activo && { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={o.etiqueta} accessibilityState={{ selected: activo }}>
            <Icono name={o.icono} size={compacto ? 11 : 13} color={activo ? '#fff' : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function CampanaNotificaciones() {
  const { colors } = useTheme();
  const { usuario } = useAuth();
  const [abierta, setAbierta] = useState(false);
  const [lista, setLista] = useState<Notificacion[]>([]);
  const noLeidas = lista.filter((n) => !n.leida).length;

  const cargar = useCallback(() => {
    if (!usuario) return setLista([]);
    listarNotificaciones().then(setLista).catch(() => setLista([]));
  }, [usuario]);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 30000);
    const quitar = escuchar('notificaciones-actualizadas', cargar);
    return () => {
      clearInterval(intervalo);
      quitar();
    };
  }, [cargar]);

  if (!usuario) return null;

  const abrir = () => {
    setAbierta(true);
    if (noLeidas > 0) {
      setLista((actual) => actual.map((n) => ({ ...n, leida: true })));
      marcarNotificacionesLeidas().catch(() => undefined);
    }
  };

  const eliminar = async (n: Notificacion) => {
    try {
      await eliminarNotificacion(n.id);
      setLista((actual) => actual.filter((item) => item.id !== n.id));
      notificar({ tipo: 'success', titulo: 'Notificación eliminada', mensaje: 'La notificación se eliminó correctamente.' });
    } catch {
      notificar({ tipo: 'error', titulo: 'Notificaciones', mensaje: 'No se pudo eliminar la notificación.' });
    }
  };

  return (
    <>
      <Pressable onPress={abrir} style={[styles.campana, { borderColor: colors.border, backgroundColor: colors.cardElevated }]} accessibilityRole="button" accessibilityLabel={`Notificaciones${noLeidas ? `, ${noLeidas} nuevas` : ''}`}>
        <Icono name="bell" size={15} color={colors.text} />
        {noLeidas > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeTexto}>{noLeidas > 9 ? '9+' : noLeidas}</Text>
          </View>
        )}
      </Pressable>
      <AppModal visible={abierta} onClose={() => setAbierta(false)} titulo="Notificaciones" anchoMaximo={460}>
        <Text style={{ color: colors.textDim, fontSize: 12.5, marginBottom: 4 }}>{noLeidas > 0 ? `${noLeidas} nuevas` : 'Estás al día'}</Text>
        {lista.length === 0 && <Vacio texto="No tienes notificaciones por el momento." icono="bell-slash" />}
        {lista.map((n) => (
          <View key={n.id} style={[styles.notif, { borderColor: colors.border, backgroundColor: n.leida ? 'transparent' : colors.primarySoft }]}>
            <View style={[styles.notifIcono, { backgroundColor: colors.cardElevated }]}>
              <Icono name={iconoNotificacion(n.tipo)} size={14} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.notifFila}>
                <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{n.titulo}</Text>
                <Text style={{ color: colors.textDim, fontSize: 11 }}>{tiempoRelativo(n.created_at)}</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>{n.mensaje}</Text>
            </View>
            {n.tipo === 'reserva' && /cancelad/i.test(n.titulo) && (
              <Pressable onPress={() => void eliminar(n)} hitSlop={8} accessibilityLabel="Eliminar notificación">
                <Icono name="xmark" size={13} color={colors.textDim} />
              </Pressable>
            )}
          </View>
        ))}
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  logo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoImg: { width: 36, height: 36 },
  logoTexto: { fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  tema: { flexDirection: 'row', borderWidth: 1, borderRadius: Radius.full, padding: 3, gap: 2 },
  temaBoton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  temaBotonCompacto: { width: 26, height: 26, borderRadius: 13 },
  campana: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTexto: { color: '#fff', fontSize: 10, fontWeight: '900' },
  notif: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: Radius.md, borderWidth: 1 },
  notifIcono: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notifFila: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
