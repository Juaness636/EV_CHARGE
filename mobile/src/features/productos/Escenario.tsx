// Escenario de estudio para las fotos de producto: fondo con la luz de la categoría,
// luz de color sobre el fondo, línea de luz en el piso y zoom suave al pasar el mouse.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducirMovimiento, usarNativo } from '../../components/animacion';
import { estiloCategoria, type ProductoCatalogo } from './productos.data';

// En Web el halo se mezcla en modo "screen": ilumina el fondo oscuro de la foto sin tapar el producto.
const esWeb = Platform.OS === 'web';
const halo = esWeb ? ({ filter: 'blur(48px)', mixBlendMode: 'screen' } as object) : null;

export function Escenario({ producto, activo = false, indice, grande = false, style }: {
  producto: ProductoCatalogo;
  activo?: boolean;
  indice?: number;
  grande?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const estilo = estiloCategoria[producto.categoria];
  const reducir = useReducirMovimiento();
  const zoom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducir) return;
    Animated.timing(zoom, { toValue: activo ? 1 : 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: usarNativo }).start();
  }, [activo, reducir, zoom]);

  return (
    <View style={[styles.caja, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }]}>
        <Image source={producto.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
      </Animated.View>
      {/* Luz de estudio con el color de la categoría */}
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, halo, { backgroundColor: estilo.acento, opacity: zoom.interpolate({ inputRange: [0, 1], outputRange: esWeb ? [0.22, 0.38] : [0.05, 0.1] }) }]}
      />
      {/* Viñeta y línea de luz del piso */}
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'transparent', 'rgba(0,0,0,0.55)']} locations={[0, 0.2, 0.7, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', estilo.acento, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.lineaPiso, { opacity: activo ? 0.9 : 0.45 }]}
        pointerEvents="none"
      />
      {indice !== undefined && <Text style={[styles.indice, grande && { fontSize: 120 }]}>{String(indice + 1).padStart(2, '0')}</Text>}
      <View style={[styles.lema, { borderColor: estilo.acentoSuave }]}>
        <View style={[styles.punto, { backgroundColor: estilo.acento }]} />
        <Text style={styles.lemaTexto}>{estilo.lema}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: '#050605' },
  halo: { position: 'absolute', width: '80%', height: '45%', left: '10%', top: '-12%', borderRadius: 9999 },
  indice: { position: 'absolute', top: 2, right: 14, fontSize: 72, fontWeight: '900', color: 'rgba(255,255,255,0.1)', letterSpacing: -2 },
  lineaPiso: { position: 'absolute', left: '10%', right: '10%', bottom: 6, height: 2, borderRadius: 1 },
  lema: { position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  punto: { width: 6, height: 6, borderRadius: 3 },
  lemaTexto: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
});
