// Tarjeta animada sobre el mapa mientras se calcula una ruta: un carro recorre una vía
// punteada hasta la estación y las etapas se marcan a medida que avanzan.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Radius } from '../../theme/spacing';
import { Aparecer, CheckAnimado, usarNativo, useReducirMovimiento } from '../../components/animacion';
import { Icono } from '../../components/ui';
import type { EtapaRuta } from './useNavegacion';

const ETAPAS: Array<{ clave: EtapaRuta; texto: string; icono: string }> = [
  { clave: 'ubicacion', texto: 'Obteniendo tu ubicación…', icono: 'location-crosshairs' },
  { clave: 'ruta', texto: 'Trazando la mejor ruta…', icono: 'route' },
  { clave: 'lista', texto: '¡Ruta lista!', icono: 'flag-checkered' },
];

const ANCHO_PISTA = 220;

export function CargaRuta({ etapa }: { etapa: EtapaRuta | null }) {
  const { colors } = useTheme();
  const reducir = useReducirMovimiento();
  const avance = useRef(new Animated.Value(0)).current;
  const [anchoPista, setAnchoPista] = useState(ANCHO_PISTA);

  useEffect(() => {
    if (!etapa || etapa === 'lista' || reducir) return;
    avance.setValue(0);
    const bucle = Animated.loop(Animated.timing(avance, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: usarNativo }));
    bucle.start();
    return () => bucle.stop();
  }, [etapa, reducir, avance]);

  if (!etapa) return null;
  const indice = ETAPAS.findIndex((e) => e.clave === etapa);
  const lista = etapa === 'lista';

  return (
    <View pointerEvents="none" style={styles.contenedor}>
      <Aparecer desde="escala" duracion={280}>
        <View style={[styles.tarjeta, { backgroundColor: colors.card, borderColor: lista ? colors.primary : colors.border }]}>
          {lista ? (
            <View style={{ alignItems: 'center' }}><CheckAnimado tamano={52} /></View>
          ) : (
            <View style={styles.escena} onLayout={(e) => setAnchoPista(e.nativeEvent.layout.width)}>
              <View style={[styles.pista, { borderColor: colors.primaryBorder }]} />
              <View style={[styles.destino, { backgroundColor: colors.primary }]}>
                <Icono name="charging-station" size={14} color="#fff" />
              </View>
              <Animated.View
                style={[styles.carro, {
                  backgroundColor: colors.info,
                  transform: [
                    { translateX: avance.interpolate({ inputRange: [0, 1], outputRange: [0, anchoPista - 70] }) },
                    { translateY: avance.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -2, 0, -2, 0] }) },
                  ],
                }]}
              >
                <Icono name="car-side" size={15} color="#fff" />
              </Animated.View>
            </View>
          )}
          <View style={{ gap: 6, marginTop: 4 }}>
            {ETAPAS.map((e, i) => {
              const hecha = i < indice || lista;
              const actual = i === indice && !lista;
              const color = hecha ? colors.primary : actual ? colors.text : colors.textDim;
              return (
                <View key={e.clave} style={styles.etapa}>
                  <Icono name={hecha ? 'circle-check' : e.icono} size={13} color={color} />
                  <Text style={{ color, fontSize: 13.5, fontWeight: actual || (lista && e.clave === 'lista') ? '800' : '600' }}>{e.texto}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </Aparecer>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  tarjeta: {
    width: 280, padding: 18, borderRadius: Radius.lg, borderWidth: 1.5, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  escena: { height: 46, justifyContent: 'center' },
  pista: { position: 'absolute', left: 10, right: 34, top: 22, borderTopWidth: 3, borderStyle: 'dashed' },
  destino: { position: 'absolute', right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  carro: { width: 36, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  etapa: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
