// Ruta hasta una estación y navegación con GPS (expo-location), con recálculo si el
// usuario se desvía y modo de simulación para pruebas. Equivale a la lógica de MapaPage del web.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { planificarViaje } from '../../api/mapa.api';
import { notificar } from '../../components/Notificaciones';
import { calcularRumbo, distanciaKm } from '../../utils/estaciones';
import { haptica } from '../../utils/haptica';
import type { LeafletMapHandle } from './usePuenteMapa';

const PRECISION_MAXIMA_METROS = 500;
export type EtapaRuta = 'ubicacion' | 'ruta' | 'lista';
type Punto = [number, number];

async function obtenerPermiso(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') return true;
  } catch {
    // En web sin HTTPS el navegador bloquea la geolocalización.
  }
  const enWebInsegura = Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext;
  notificar({
    tipo: 'warning',
    titulo: 'Ubicación',
    mensaje: enWebInsegura
      ? 'El navegador solo permite el GPS por HTTPS o desde localhost. Usa la app en el celular (Expo Go) o abre la web desde localhost.'
      : 'Permiso de ubicación denegado. Actívalo en los ajustes para usar el GPS.',
  });
  return false;
}

function precisionValida(pos: Location.LocationObject) {
  const precision = pos.coords.accuracy;
  return precision == null || (Number.isFinite(precision) && precision <= PRECISION_MAXIMA_METROS);
}

export function useNavegacion(mapa: RefObject<LeafletMapHandle | null>) {
  const [infoRuta, setInfoRuta] = useState<string | null>(null);
  // Etapas visibles mientras se calcula una ruta (las muestra CargaRuta).
  const [etapaRuta, setEtapaRuta] = useState<EtapaRuta | null>(null);
  const cargandoRuta = etapaRuta === 'ubicacion' || etapaRuta === 'ruta';
  const [navegando, setNavegando] = useState(false);
  const [pausada, setPausada] = useState(false);
  const [simulando, setSimulando] = useState(false);
  const [distanciaRestante, setDistanciaRestante] = useState<number | null>(null);
  const [instruccion, setInstruccion] = useState('');
  const [desvio, setDesvio] = useState(false);

  const ruta = useRef<Punto[]>([]);
  const destino = useRef<Punto | null>(null);
  const instrucciones = useRef<Array<{ nombre: string; modificador: string }>>([]);
  const suscripcion = useRef<Location.LocationSubscription | null>(null);
  const simulacion = useRef<ReturnType<typeof setInterval> | null>(null);
  const ultimaPosicion = useRef<Punto | null>(null);
  const recalculando = useRef(false);
  const rumbo = useRef(0);

  const enviar = (comando: Parameters<LeafletMapHandle['enviar']>[0]) => mapa.current?.enviar(comando);

  const pintarRuta = (puntos: Punto[], ajustar: boolean) => {
    ruta.current = puntos;
    enviar({ tipo: 'ruta', puntos, ajustar });
    enviar({ tipo: 'recorrido', puntos: null });
  };

  const actualizarRecorrido = (indice: number) => {
    const puntos = ruta.current.slice(0, Math.max(2, Math.min(indice, ruta.current.length - 1) + 1));
    if (puntos.length > 1) enviar({ tipo: 'recorrido', puntos });
  };

  const detenerSeguimiento = () => {
    suscripcion.current?.remove();
    suscripcion.current = null;
    if (simulacion.current) clearInterval(simulacion.current);
    simulacion.current = null;
  };

  const actualizarPosicion = useCallback((pos: Location.LocationObject) => {
    if (!precisionValida(pos)) return;
    const actual: Punto = [pos.coords.latitude, pos.coords.longitude];
    const anterior = ultimaPosicion.current;
    if (anterior && distanciaKm(actual, anterior) < 0.008) return;
    const rumboGps = pos.coords.heading;
    if (typeof rumboGps === 'number' && rumboGps >= 0 && (pos.coords.speed == null || pos.coords.speed > 0.5)) rumbo.current = rumboGps;
    else if (anterior) rumbo.current = calcularRumbo(anterior, actual);
    ultimaPosicion.current = actual;
    enviar({ tipo: 'usuario', lat: actual[0], lon: actual[1], rumbo: rumbo.current, seguir: true });

    const puntos = ruta.current;
    if (!puntos.length) return;
    let indiceCercano = 0;
    let distanciaCercana = Number.POSITIVE_INFINITY;
    puntos.forEach((p, i) => {
      const d = distanciaKm(actual, p);
      if (d < distanciaCercana) { distanciaCercana = d; indiceCercano = i; }
    });
    actualizarRecorrido(indiceCercano);
    const fin = destino.current;
    if (fin) setDistanciaRestante(distanciaKm(actual, fin));

    const desviado = distanciaCercana > 0.5;
    setDesvio(desviado);
    if (desviado && fin && !recalculando.current) {
      recalculando.current = true;
      planificarViaje(actual[0], actual[1], fin[0], fin[1], 300)
        .then((plan) => {
          pintarRuta(plan.geometry.coordinates.map(([lon, lat]) => [lat, lon] as Punto), false);
          instrucciones.current = (plan.instrucciones || []).map((p) => ({ nombre: p.nombre, modificador: p.modificador }));
          setInfoRuta(`Ruta recalculada: ${plan.distancia_total_km} km · ${plan.duracion_min} min`);
          setDesvio(false);
        })
        .catch(() => setInfoRuta('No se pudo recalcular la ruta. Puedes intentarlo nuevamente.'))
        .finally(() => { recalculando.current = false; });
    }

    const lista = instrucciones.current;
    const paso = lista[Math.min(lista.length - 1, Math.floor((indiceCercano / Math.max(1, puntos.length)) * lista.length))];
    if (paso) setInstruccion(`Continúa por ${paso.nombre || 'la vía'}${paso.modificador ? `, ${paso.modificador}` : ''}`);
    if (fin && distanciaKm(actual, fin) < 0.05) setInstruccion('Has llegado a la estación.');
  }, []);

  const iniciarNavegacion = useCallback(async () => {
    if (!ruta.current.length) return;
    detenerSeguimiento();
    ultimaPosicion.current = null;
    setSimulando(false);
    setNavegando(true);
    setPausada(false);
    try {
      suscripcion.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 8 },
        actualizarPosicion,
        () => setInfoRuta('No se pudo actualizar tu ubicación. Revisa el permiso de GPS.'),
      );
    } catch {
      setInfoRuta('No se pudo iniciar el seguimiento GPS.');
      setNavegando(false);
    }
  }, [actualizarPosicion]);

  const calcularRuta = useCallback(async (destLat: number, destLon: number) => {
    if (!(await obtenerPermiso())) return;
    setEtapaRuta('ubicacion');
    let exito = false;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!precisionValida(pos)) {
        notificar({ tipo: 'warning', titulo: 'Ubicación', mensaje: 'El GPS todavía no tiene suficiente precisión. Espera unos segundos y vuelve a intentarlo.' });
        return;
      }
      const origen: Punto = [pos.coords.latitude, pos.coords.longitude];
      detenerSeguimiento();
      rumbo.current = pos.coords.heading && pos.coords.heading >= 0 ? pos.coords.heading : 0;
      enviar({ tipo: 'usuario', lat: origen[0], lon: origen[1], rumbo: rumbo.current, seguir: false });
      setEtapaRuta('ruta');
      const plan = await planificarViaje(origen[0], origen[1], destLat, destLon, 300);
      destino.current = [destLat, destLon];
      instrucciones.current = (plan.instrucciones || []).map((p) => ({ nombre: p.nombre, modificador: p.modificador }));
      pintarRuta(plan.geometry.coordinates.map(([lon, lat]) => [lat, lon] as Punto), true);
      let texto = `Distancia: ${plan.distancia_total_km} km · Tiempo: ${plan.duracion_min} min`;
      if (plan.paradas_sugeridas > 0) texto += ` · ${plan.paradas_sugeridas} parada(s) sugerida(s)`;
      setInfoRuta(texto);
      setInstruccion('');
      setDistanciaRestante(distanciaKm(origen, [destLat, destLon]));
      exito = true;
      setEtapaRuta('lista');
      haptica.exito();
      setTimeout(() => setEtapaRuta((actual) => (actual === 'lista' ? null : actual)), 1300);
      await iniciarNavegacion();
    } catch (e) {
      haptica.error();
      notificar({ tipo: 'error', titulo: 'Ruta', mensaje: e instanceof Error && e.message.includes('servidor') ? e.message : 'No se pudo calcular la ruta. Verifica el GPS y que el backend esté activo.' });
    } finally {
      if (!exito) setEtapaRuta(null);
    }
  }, [iniciarNavegacion]);

  const pausar = useCallback(() => {
    detenerSeguimiento();
    setSimulando(false);
    setNavegando(false);
    setPausada(true);
  }, []);

  const detener = useCallback((limpiar = false) => {
    detenerSeguimiento();
    setSimulando(false);
    setNavegando(false);
    setPausada(false);
    if (limpiar) {
      enviar({ tipo: 'ruta', puntos: null, ajustar: false });
      enviar({ tipo: 'recorrido', puntos: null });
      enviar({ tipo: 'quitarUsuario' });
      ruta.current = [];
      destino.current = null;
      setInfoRuta(null);
      setDistanciaRestante(null);
      setInstruccion('');
      setDesvio(false);
    }
  }, []);

  const simular = useCallback(() => {
    if (!ruta.current.length || !destino.current) return;
    detenerSeguimiento();
    let indice = 0;
    setNavegando(true);
    setPausada(false);
    setSimulando(true);
    simulacion.current = setInterval(() => {
      const punto = ruta.current[indice];
      const fin = destino.current;
      if (!punto || !fin) return detener(false);
      const siguiente = ruta.current[Math.min(indice + 1, ruta.current.length - 1)];
      rumbo.current = calcularRumbo(punto, siguiente);
      enviar({ tipo: 'usuario', lat: punto[0], lon: punto[1], rumbo: rumbo.current, seguir: true });
      actualizarRecorrido(indice);
      setDistanciaRestante(distanciaKm(punto, fin));
      setInfoRuta('Navegación de prueba activa · ubicación simulada');
      indice += Math.max(1, Math.ceil(ruta.current.length / 35));
      if (indice >= ruta.current.length) {
        detenerSeguimiento();
        actualizarRecorrido(ruta.current.length - 1);
        setSimulando(false);
        setNavegando(false);
        setInstruccion('Prueba finalizada: llegaste a la estación.');
      }
    }, 1000);
  }, [detener]);

  const irAMiUbicacion = useCallback(async () => {
    if (!(await obtenerPermiso())) return;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!precisionValida(pos)) {
        notificar({ tipo: 'warning', titulo: 'Ubicación', mensaje: 'No se pudo obtener una ubicación precisa. Activa el GPS y vuelve a intentarlo.' });
        return;
      }
      enviar({ tipo: 'usuario', lat: pos.coords.latitude, lon: pos.coords.longitude, rumbo: rumbo.current, seguir: true });
    } catch {
      notificar({ tipo: 'warning', titulo: 'Ubicación', mensaje: 'No se pudo obtener tu ubicación. Revisa el GPS y el permiso de ubicación.' });
    }
  }, []);

  useEffect(() => () => detenerSeguimiento(), []);

  return {
    infoRuta, cargandoRuta, etapaRuta, navegando, pausada, simulando, distanciaRestante, instruccion, desvio,
    calcularRuta, iniciarNavegacion, pausar, detener, simular, irAMiUbicacion,
  };
}
