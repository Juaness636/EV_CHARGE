// Estructura común del dashboard de usuario y del panel de administración:
// barra lateral en PC/tablet y pestañas desplazables en celular.
import React, { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import type { Palette } from '../theme/colors';
import { BREAKPOINT_ESCRITORIO, Radius, Spacing } from '../theme/spacing';
import { CampanaNotificaciones, Logo, SelectorTema } from './Cabecera';
import { Icono } from './ui';
import { Aparecer } from './animacion';

export interface ItemPanel<T extends string> {
  clave: T;
  icono: string;
}

interface Props<T extends string> {
  paneles: ItemPanel<T>[];
  activo: T;
  onCambiar: (panel: T) => void;
  titulo: string;
  subtitulo: string;
  nombreUsuario: string;
  detalleUsuario: string;
  onCerrarSesion: () => void;
  refrescando?: boolean;
  onRefrescar?: () => void;
  children: ReactNode;
}

export function PanelLayout<T extends string>({
  paneles, activo, onCambiar, titulo, subtitulo, nombreUsuario, detalleUsuario, onCerrarSesion, refrescando = false, onRefrescar, children,
}: Props<T>) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const escritorio = width >= BREAKPOINT_ESCRITORIO;
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [activo]);

  const contenido = (
    <ScrollView
      ref={scroll}
      style={{ flex: 1 }}
      contentContainerStyle={[s.contenido, { paddingBottom: insets.bottom + 100 }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefrescar ? <RefreshControl refreshing={refrescando} onRefresh={onRefrescar} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      <View style={s.encabezado}>
        <View style={{ flex: 1 }}>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.subtitulo}>{subtitulo}</Text>
        </View>
        {escritorio && (
          <Pressable onPress={() => router.push('/mapa')} style={s.botonMapa} accessibilityRole="button">
            <Icono name="map-location-dot" size={13} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800' }}>Mapa</Text>
          </Pressable>
        )}
      </View>
      <Aparecer key={activo} duracion={320}>
        <View style={{ gap: Spacing.md }}>{children}</View>
      </Aparecer>
    </ScrollView>
  );

  if (escritorio) {
    return (
      <View style={[s.pantalla, { flexDirection: 'row' }]}>
        <View style={[s.lateral, { paddingTop: insets.top + Spacing.md }]}>
          <Logo />
          <View style={s.usuario}>
            <Text style={s.usuarioNombre} numberOfLines={1}>{nombreUsuario}</Text>
            <Text style={s.usuarioDetalle} numberOfLines={1}>{detalleUsuario}</Text>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
            {paneles.map((p) => {
              const activa = p.clave === activo;
              return (
                <Pressable key={p.clave} onPress={() => onCambiar(p.clave)} style={[s.navItem, activa && s.navItemActivo]} accessibilityRole="tab" accessibilityState={{ selected: activa }}>
                  <Icono name={p.icono} size={14} color={activa ? colors.primary : colors.textMuted} />
                  <Text style={[s.navTexto, activa && { color: colors.primary }]}>{p.clave}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={s.lateralPie}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <SelectorTema compacto />
              <CampanaNotificaciones />
            </View>
            <Pressable onPress={() => router.push('/mapa')} style={s.navItem}><Icono name="map" size={14} color={colors.textMuted} /><Text style={s.navTexto}>Abrir mapa</Text></Pressable>
            <Pressable onPress={() => router.navigate('/')} style={s.navItem}><Icono name="house" size={14} color={colors.textMuted} /><Text style={s.navTexto}>Inicio</Text></Pressable>
            <Pressable onPress={onCerrarSesion} style={s.navItem}><Icono name="right-from-bracket" size={14} color={colors.error} /><Text style={[s.navTexto, { color: colors.error }]}>Cerrar sesión</Text></Pressable>
          </View>
        </View>
        <View style={{ flex: 1 }}>{contenido}</View>
      </View>
    );
  }

  return (
    <View style={s.pantalla}>
      <View style={[s.barraMovil, { paddingTop: insets.top + 8 }]}>
        <View style={s.filaMovil}>
          <Logo mostrarNombre={false} />
          <View style={{ flex: 1 }}>
            <Text style={s.usuarioNombre} numberOfLines={1}>{nombreUsuario}</Text>
            <Text style={s.usuarioDetalle} numberOfLines={1}>{detalleUsuario}</Text>
          </View>
          <CampanaNotificaciones />
          <Pressable onPress={() => router.push('/mapa')} style={s.iconoBoton} accessibilityLabel="Abrir mapa"><Icono name="map-location-dot" size={15} color={colors.primary} /></Pressable>
          <Pressable onPress={onCerrarSesion} style={s.iconoBoton} accessibilityLabel="Cerrar sesión"><Icono name="right-from-bracket" size={15} color={colors.error} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pestanas}>
          {paneles.map((p) => {
            const activa = p.clave === activo;
            return (
              <Pressable key={p.clave} onPress={() => onCambiar(p.clave)} style={[s.pestana, activa && s.pestanaActiva]} accessibilityRole="tab" accessibilityState={{ selected: activa }}>
                <Icono name={p.icono} size={12} color={activa ? '#fff' : colors.textMuted} />
                <Text style={[s.pestanaTexto, activa && { color: '#fff' }]}>{p.clave}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {contenido}
      <View style={[s.temaMovil, { bottom: insets.bottom + 20 }]}><SelectorTema compacto /></View>
    </View>
  );
}

const crearEstilos = (c: Palette) => StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: c.bg },
  lateral: { width: 250, borderRightWidth: 1, borderRightColor: c.border, backgroundColor: c.bg2, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.md },
  usuario: { padding: 12, borderRadius: Radius.md, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  usuarioNombre: { color: c.text, fontWeight: '800', fontSize: 14 },
  usuarioDetalle: { color: c.textDim, fontSize: 12 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md },
  navItemActivo: { backgroundColor: c.primarySoft },
  navTexto: { color: c.textMuted, fontWeight: '700', fontSize: 14 },
  lateralPie: { gap: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: Spacing.sm },
  contenido: { padding: Spacing.md, gap: Spacing.md, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { color: c.text, fontSize: 24, fontWeight: '900' },
  subtitulo: { color: c.textMuted, fontSize: 13.5 },
  botonMapa: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.md },
  barraMovil: { backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 12, paddingBottom: 8, gap: 10 },
  filaMovil: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconoBoton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated, alignItems: 'center', justifyContent: 'center' },
  pestanas: { gap: 8 },
  pestana: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated },
  pestanaActiva: { backgroundColor: c.primary, borderColor: c.primary },
  pestanaTexto: { color: c.textMuted, fontWeight: '700', fontSize: 13 },
  temaMovil: { position: 'absolute', left: 16 },
});
