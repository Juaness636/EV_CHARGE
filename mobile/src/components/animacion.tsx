// Animaciones reutilizables de EV Charge (API Animated de React Native: funciona en
// Android, iOS y Web). Respetan la opción "reducir movimiento" del sistema.
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { Icono } from './ui/Icono';

export const usarNativo = Platform.OS !== 'web';
const LOGO = require('../../assets/images/logo.png');

let reducirMovimientoGlobal = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reducirMovimientoGlobal = v; }).catch(() => undefined);

export function useReducirMovimiento(): boolean {
  const [reducir, setReducir] = useState(reducirMovimientoGlobal);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then(setReducir).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReducir);
    return () => sub?.remove?.();
  }, []);
  return reducir;
}

// Valor que oscila entre 0 y 1 indefinidamente (pulsos, respiración, brillos).
function useBucle(duracion: number, activo = true, retraso = 0): Animated.Value {
  const valor = useRef(new Animated.Value(0)).current;
  const reducir = useReducirMovimiento();
  useEffect(() => {
    if (!activo || reducir) return;
    const bucle = Animated.loop(Animated.sequence([
      Animated.delay(retraso),
      Animated.timing(valor, { toValue: 1, duration: duracion / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: usarNativo }),
      Animated.timing(valor, { toValue: 0, duration: duracion / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: usarNativo }),
    ]));
    bucle.start();
    return () => bucle.stop();
  }, [activo, reducir, duracion, retraso, valor]);
  return valor;
}

// Logo de EV Charge girando con un halo que pulsa. Reemplaza los spinners genéricos.
export function LogoCargando({ tamano = 48, color, conHalo = true }: { tamano?: number; color?: string; conHalo?: boolean }) {
  const { colors } = useTheme();
  const reducir = useReducirMovimiento();
  const giro = useRef(new Animated.Value(0)).current;
  const pulso = useBucle(1400);
  const tinte = color ?? (colors.modo === 'dark' ? '#ffffff' : colors.primary);

  useEffect(() => {
    if (reducir) return;
    const bucle = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: usarNativo }));
    bucle.start();
    return () => bucle.stop();
  }, [reducir, giro]);

  const rotacion = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const escalaHalo = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] });
  const opacidadHalo = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });

  return (
    <View style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityLabel="Cargando">
      {conHalo && (
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: tamano / 2, backgroundColor: colors.primary, opacity: opacidadHalo, transform: [{ scale: escalaHalo }] }]} />
      )}
      <Animated.Image source={LOGO} resizeMode="contain" style={{ width: tamano * 0.8, height: tamano * 0.8, tintColor: tinte, transform: [{ rotate: rotacion }] }} />
    </View>
  );
}

// Aparición con desvanecido y desplazamiento. Si `visible` es false espera a que cambie.
export function Aparecer({ children, retraso = 0, visible = true, desde = 'abajo', duracion = 450, style }: {
  children: ReactNode; retraso?: number; visible?: boolean; desde?: 'abajo' | 'arriba' | 'izquierda' | 'escala'; duracion?: number; style?: StyleProp<ViewStyle>;
}) {
  const reducir = useReducirMovimiento();
  const valor = useRef(new Animated.Value(reducir ? 1 : 0)).current;
  useEffect(() => {
    if (!visible) return;
    if (reducir) return valor.setValue(1);
    const anim = Animated.timing(valor, { toValue: 1, duration: duracion, delay: retraso, easing: Easing.out(Easing.cubic), useNativeDriver: usarNativo });
    anim.start();
    return () => anim.stop();
  }, [visible, reducir, retraso, duracion, valor]);

  const transform = desde === 'escala'
    ? [{ scale: valor.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }]
    : desde === 'izquierda'
      ? [{ translateX: valor.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }]
      : [{ translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [desde === 'arriba' ? -40 : 28, 0] }) }];
  return <Animated.View style={[style, { opacity: valor, transform }]}>{children}</Animated.View>;
}

// ---- Revelado al hacer scroll (equivale a la clase `.reveal` del web) ----
interface DatosRevelar { limiteVisible: number }
const ContextoRevelar = createContext<DatosRevelar>({ limiteVisible: Number.POSITIVE_INFINITY });
const ContextoSeccion = createContext(true);

// Envuelve el contenido de un ScrollView: `limiteVisible` = scroll actual + alto de la vista.
export function ProveedorRevelar({ limiteVisible, children }: { limiteVisible: number; children: ReactNode }) {
  return <ContextoRevelar.Provider value={{ limiteVisible }}>{children}</ContextoRevelar.Provider>;
}

// Sección hija directa del ScrollView: se activa cuando entra en pantalla y queda visible.
export function SeccionRevelar({ children, style, onLayout }: { children: ReactNode; style?: StyleProp<ViewStyle>; onLayout?: (y: number) => void }) {
  const { limiteVisible } = useContext(ContextoRevelar);
  const [y, setY] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!visible && y !== null && limiteVisible > y + 80) setVisible(true);
  }, [limiteVisible, y, visible]);
  return (
    <View style={style} onLayout={(e) => { setY(e.nativeEvent.layout.y); onLayout?.(e.nativeEvent.layout.y); }}>
      <ContextoSeccion.Provider value={visible}>{children}</ContextoSeccion.Provider>
    </View>
  );
}

// Elemento dentro de una SeccionRevelar; `orden` escalona la entrada de las tarjetas.
export function Revelar({ children, orden = 0, desde, style }: { children: ReactNode; orden?: number; desde?: 'abajo' | 'izquierda' | 'escala'; style?: StyleProp<ViewStyle> }) {
  const visible = useContext(ContextoSeccion);
  return <Aparecer visible={visible} retraso={orden * 90} desde={desde} style={style}>{children}</Aparecer>;
}

// Escala/opacidad que "respira" en bucle (orbes del hero, halos).
export function Respirar({ children, duracion = 6000, escala = 0.12, retraso = 0, style }: { children?: ReactNode; duracion?: number; escala?: number; retraso?: number; style?: StyleProp<ViewStyle> }) {
  const v = useBucle(duracion, true, retraso);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + escala] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// Flotación vertical suave (auto de "Quiénes somos").
export function Flotar({ children, distancia = 8, duracion = 3600, style }: { children: ReactNode; distancia?: number; duracion?: number; style?: StyleProp<ViewStyle> }) {
  const v = useBucle(duracion);
  return <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -distancia] }) }] }]}>{children}</Animated.View>;
}

// Bloque "fantasma" con brillo mientras cargan los datos.
export function Esqueleto({ ancho = '100%', alto = 14, radio = 6, style }: { ancho?: number | `${number}%`; alto?: number; radio?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const v = useBucle(1300);
  return (
    <Animated.View
      style={[{ width: ancho, height: alto, borderRadius: radio, backgroundColor: colors.modo === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }, style]}
    />
  );
}

export function TarjetaEsqueleto() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Esqueleto ancho="55%" alto={16} />
        <Esqueleto ancho={70} alto={18} radio={9} />
      </View>
      <Esqueleto ancho="80%" />
      <Esqueleto ancho="65%" />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Esqueleto ancho={80} alto={30} />
        <Esqueleto ancho={80} alto={30} />
      </View>
    </View>
  );
}

// Círculo verde con un check que entra con resorte (pagos aprobados, contraseña cambiada).
export function CheckAnimado({ tamano = 72 }: { tamano?: number }) {
  const { colors } = useTheme();
  const circulo = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const onda = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.spring(circulo, { toValue: 1, friction: 5, tension: 120, useNativeDriver: usarNativo }),
        Animated.spring(check, { toValue: 1, friction: 4, tension: 160, useNativeDriver: usarNativo }),
      ]),
      Animated.timing(onda, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: usarNativo }),
    ]).start();
  }, [circulo, check, onda]);
  return (
    <View style={{ width: tamano * 1.6, height: tamano * 1.6, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: tamano, height: tamano, borderRadius: tamano / 2, borderWidth: 3, borderColor: colors.primary, opacity: onda.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: onda.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }} />
      <Animated.View style={{ width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', transform: [{ scale: circulo }] }}>
        <Animated.View style={{ opacity: check, transform: [{ scale: check.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: check.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) }] }}>
          <Icono name="check" size={tamano * 0.5} color="#fff" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// Pantalla de arranque animada: logo con halo, nombre y barra; se desvanece al estar lista la app.
export function SplashAnimado({ listo, onTerminar }: { listo: boolean; onTerminar: () => void }) {
  const entrada = useRef(new Animated.Value(0)).current;
  const salida = useRef(new Animated.Value(1)).current;
  const barra = useRef(new Animated.Value(0)).current;
  const [minimoCumplido, setMinimoCumplido] = useState(false);

  useEffect(() => {
    Animated.spring(entrada, { toValue: 1, friction: 6, tension: 60, useNativeDriver: usarNativo }).start();
    Animated.timing(barra, { toValue: 0.85, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    const t = setTimeout(() => setMinimoCumplido(true), 1300);
    return () => clearTimeout(t);
  }, [entrada, barra]);

  useEffect(() => {
    if (!listo || !minimoCumplido) return;
    Animated.sequence([
      Animated.timing(barra, { toValue: 1, duration: 250, useNativeDriver: false }),
      Animated.timing(salida, { toValue: 0, duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(() => onTerminar());
  }, [listo, minimoCumplido, barra, salida, onTerminar]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, estilosSplash.fondo, { opacity: salida }]} pointerEvents="none">
      <Resplandor diametro={420} intensidad={1.6} style={{ marginTop: -40 }} />
      <Animated.View style={{ alignItems: 'center', opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
        <Image source={LOGO} style={estilosSplash.logo} resizeMode="contain" />
        <Text style={estilosSplash.nombre}>EV CHARGE</Text>
        <Text style={estilosSplash.lema}>Movilidad eléctrica · Colombia</Text>
      </Animated.View>
      <View style={estilosSplash.pista}>
        <Animated.View style={[estilosSplash.progreso, { width: barra.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </Animated.View>
  );
}

const estilosSplash = StyleSheet.create({
  fondo: { backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center', zIndex: 2000, elevation: 50 },
  logo: { width: 130, height: 130 },
  nombre: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 6, marginTop: 12 },
  lema: { color: '#83d966', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginTop: 6, textTransform: 'uppercase' },
  pista: { position: 'absolute', bottom: 90, width: 160, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  progreso: { height: '100%', borderRadius: 2, backgroundColor: '#39a900' },
});

// Tres puntos que rebotan: "el asistente está escribiendo".
export function PuntosEscribiendo({ color }: { color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 4 }} accessibilityLabel="El asistente está escribiendo">
      {[0, 1, 2].map((i) => <PuntoRebote key={i} color={color} retraso={i * 160} />)}
    </View>
  );
}

function PuntoRebote({ color, retraso }: { color: string; retraso: number }) {
  const v = useBucle(900, true, retraso);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }} />;
}

// Resplandor verde suave (anillos concéntricos semitransparentes) que respira en bucle.
export function Resplandor({ diametro = 300, intensidad = 1, style }: { diametro?: number; intensidad?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const v = useBucle(5000);
  // Muchos anillos tenues apilados se ven como un degradado radial continuo.
  const anillos = Array.from({ length: 14 }, (_, i) => 1 - i * 0.06);
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', width: diametro, height: diametro, alignItems: 'center', justifyContent: 'center' }, style, {
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
      }]}
    >
      {anillos.map((f) => (
        <View key={f} style={{ position: 'absolute', width: diametro * f, height: diametro * f, borderRadius: (diametro * f) / 2, backgroundColor: colors.primary, opacity: 0.022 * intensidad }} />
      ))}
    </Animated.View>
  );
}
