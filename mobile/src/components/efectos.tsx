// Efectos visuales de la nueva imagen de EV Charge: vidrio esmerilado, texto con degradado,
// cuadrícula de fondo, marquesina infinita y bordes con degradado. Funcionan en Android, iOS y Web;
// lo que solo existe en CSS (blur del fondo, texto recortado al degradado) se aplica solo en Web.
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import type { Palette } from '../theme/colors';
import { useReducirMovimiento, usarNativo } from './animacion';

const esWeb = Platform.OS === 'web';

// Fondo translúcido con desenfoque (en Web) para barras y tarjetas que flotan sobre contenido.
export function estiloVidrio(c: Palette, blur = 18): ViewStyle {
  return {
    backgroundColor: c.glass,
    borderColor: c.glassBorder,
    ...(esWeb ? ({ backdropFilter: `blur(${blur}px) saturate(160%)`, WebkitBackdropFilter: `blur(${blur}px) saturate(160%)` } as object) : null),
  };
}

// Texto con degradado verde. En Web recorta el degradado al texto; en el celular usa el color de marca.
export function TextoDegradado({ children, style, colores }: { children: ReactNode; style?: StyleProp<TextStyle>; colores?: string[] }) {
  const { colors } = useTheme();
  const paleta = colores ?? (colors.modo === 'dark' ? [colors.neon, colors.primaryLight, colors.primary] : [colors.primaryLight, colors.primary, colors.primaryDim]);
  if (!esWeb) return <Text style={[style, { color: colors.modo === 'dark' ? colors.primaryLight : colors.primary }]}>{children}</Text>;
  const web = {
    backgroundImage: `linear-gradient(100deg, ${paleta.join(', ')})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  } as TextStyle;
  return <Text style={[style, web]}>{children}</Text>;
}

// Cuadrícula tenue que se desvanece hacia los bordes (fondo del hero).
export function Cuadricula({ paso = 48, style }: { paso?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [tam, setTam] = useState({ w: 0, h: 0 });
  const linea = colors.modo === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
  const columnas = Math.ceil(tam.w / paso);
  const filas = Math.ceil(tam.h / paso);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} onLayout={(e) => setTam({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {Array.from({ length: columnas }, (_, i) => <View key={`c${i}`} style={{ position: 'absolute', left: i * paso, top: 0, bottom: 0, width: 1, backgroundColor: linea }} />)}
      {Array.from({ length: filas }, (_, i) => <View key={`f${i}`} style={{ position: 'absolute', top: i * paso, left: 0, right: 0, height: 1, backgroundColor: linea }} />)}
      <LinearGradient colors={[colors.bg, 'transparent', 'transparent', colors.bg]} locations={[0, 0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[colors.bg, 'transparent', 'transparent', colors.bg]} locations={[0, 0.2, 0.8, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </View>
  );
}

// Cinta que se desplaza sin fin con los elementos repetidos (conectores, ciudades...).
export function Marquesina({ elementos, velocidad = 40, renderItem }: { elementos: string[]; velocidad?: number; renderItem: (texto: string, i: number) => ReactNode }) {
  const reducir = useReducirMovimiento();
  const [ancho, setAncho] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ancho || reducir) return;
    x.setValue(0);
    const bucle = Animated.loop(Animated.timing(x, { toValue: -ancho, duration: (ancho / velocidad) * 1000, easing: Easing.linear, useNativeDriver: usarNativo }));
    bucle.start();
    return () => bucle.stop();
  }, [ancho, reducir, velocidad, x]);
  return (
    <View style={{ overflow: 'hidden', width: '100%' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        {[0, 1].map((copia) => (
          <View key={copia} style={{ flexDirection: 'row' }} onLayout={copia === 0 ? (e) => setAncho(e.nativeEvent.layout.width) : undefined}>
            {elementos.map((t, i) => <React.Fragment key={`${copia}-${t}`}>{renderItem(t, i)}</React.Fragment>)}
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

// Tarjeta con borde de 1 px en degradado (verde → transparente) y fondo propio.
export function BordeDegradado({ children, radio = 18, style, interior }: { children: ReactNode; radio?: number; style?: StyleProp<ViewStyle>; interior?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.primaryBorder, colors.border, colors.primarySoft]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radio, padding: 1 }, style]}
    >
      <View style={[{ borderRadius: radio - 1, backgroundColor: colors.card, flex: 1 }, interior]}>{children}</View>
    </LinearGradient>
  );
}

// Punto que late (indicador "en vivo").
export function PuntoVivo({ color, tamano = 8 }: { color: string; tamano?: number }) {
  const reducir = useReducirMovimiento();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducir) return;
    const bucle = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: usarNativo }));
    bucle.start();
    return () => bucle.stop();
  }, [reducir, v]);
  return (
    <View style={{ width: tamano * 2, height: tamano * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: tamano * 2, height: tamano * 2, borderRadius: tamano, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }] }} />
      <View style={{ width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: color }} />
    </View>
  );
}
