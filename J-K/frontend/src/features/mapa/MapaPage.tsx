// Migrado desde public/mapa.html. Corresponde a mapa_controller.py / mapa_routes.py
// para la ruta vial; las estaciones se cargan directo de OpenChargeMap (API externa),
// igual que en el original.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/estilos_mapa.css';
import '../../styles/dashboard.css';
import '../../styles/admin.css';
import { useAuth } from '../../context/AuthContext';
import { AuthModal, type AuthTab } from '../../components/AuthModal';
import { notificar } from '../../components/GlobalNotifications';
import { planificarViaje } from '../../api/mapa.api';
import { api } from '../../api/httpClient';
import { EstacionDetalle } from './components/EstacionDetalle';
import { obtenerEstadoEstacion } from '../../api/estado.api';
import { listarVehiculos, type Vehiculo } from '../../api/vehiculos.api';
import type { EstacionOCM } from './types';

const BOGOTA: [number, number] = [4.6651, -74.1204];
const LIMITES_COLOMBIA: L.LatLngBoundsExpression = [[-4.5, -81.5], [13.8, -66.5]];
const PRECISION_GPS_MAXIMA_METROS = 500;

const departamentoCanonico = (departamento?: string) => {
  const valor = (departamento || '').trim();
  const clave = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  if (clave === 'dc' || clave === 'bogota' || clave === 'bogota dc' || clave === 'bogota distrito capital') return 'Bogotá D.C.';
  const nombres: Record<string, string> = {
    antioquia: 'Antioquia', boyaca: 'Boyacá', bolivar: 'Bolívar', cauca: 'Cauca',
    caldas: 'Caldas', cundinamarca: 'Cundinamarca', meta: 'Meta', narino: 'Nariño',
    quindio: 'Quindío', santander: 'Santander', tolima: 'Tolima', huila: 'Huila',
    atlantico: 'Atlántico', cordoba: 'Córdoba', cesar: 'Cesar', guajira: 'La Guajira',
    risaralda: 'Risaralda', sucre: 'Sucre', valle: 'Valle del Cauca', 'valle del cauca': 'Valle del Cauca',
    'norte de santander': 'Norte de Santander', magdalena: 'Magdalena', choco: 'Chocó', casanare: 'Casanare', caqueta: 'Caquetá',
  };
  return nombres[clave] || valor;
};

const colorEstado = (estado: string) => estado === 'mantenimiento' ? '#f39c12' : estado === 'inactiva' ? '#e74c3c' : estado === 'reservada' ? '#3498db' : '#39a900';
const nombreRumbo = (grados: number) => ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste'][Math.round((grados % 360) / 45) % 8];
// El color del pin siempre es el del estado (verde = disponible), nunca el de la marca de la empresa:
// la marca se ve en el detalle de la estación.
const crearIconoEstacion = (estado: string, seleccionado = false) => {
  const color = colorEstado(estado);
  const icono = estado === 'mantenimiento' ? 'fa-screwdriver-wrench' : estado === 'inactiva' ? 'fa-ban' : estado === 'reservada' ? 'fa-clock' : 'fa-bolt';
  const dimension = seleccionado ? 40 : 34;
  const sombra = seleccionado ? `0 0 0 3px #fff, 0 0 0 6px ${color}, 0 6px 18px rgba(0,0,0,0.6)` : `0 3px 12px rgba(0,0,0,0.45)`;
  return L.divIcon({
    html: `<div style="width:${dimension}px;height:${dimension}px;border-radius:12px 12px 12px 4px;transform:rotate(-45deg);background:linear-gradient(145deg, ${color}, ${color}bb);border:2px solid #fff;box-shadow:${sombra};display:flex;align-items:center;justify-content:center"><i class="fa-solid ${icono}" style="transform:rotate(45deg);color:#fff;font-size:${seleccionado ? 18 : 15}px"></i></div>`,
    iconSize: [dimension, dimension],
    iconAnchor: [dimension / 2, dimension / 2 + 4],
    className: '',
  });
};

const crearIconoVehiculo = () => L.divIcon({
  html: '<div style="width:34px;height:34px;border-radius:50%;background:#39a900;border:3px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px"><i class="fa-solid fa-car-side"></i></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  className: '',
});

const crearIconoUbicacion = (rumbo = 0) => L.divIcon({
  html: `<div class="user-location-car" style="transform:rotate(${rumbo}deg)"><i class="fa-solid fa-car-side"></i></div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  className: 'user-location-car-icon',
});

export function MapaPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapaAjustadoInicialmenteRef = useRef(false);
  const marcadoresRef = useRef<L.Marker[]>([]);
  const marcadorSeleccionadoRef = useRef<L.Marker | null>(null);
  const rutaCapaRef = useRef<L.GeoJSON | null>(null);
  const rutaRecorridaRef = useRef<L.Polyline | null>(null);
  const usuarioMarcadorRef = useRef<L.Marker | null>(null);

  const [estaciones, setEstaciones] = useState<EstacionOCM[]>([]);
  const [estadosEstaciones, setEstadosEstaciones] = useState<Record<string, { estado: string; cargadores_reservados?: string[] }>>({});
  const [filtro, setFiltro] = useState('TODOS');
  const [filtroDepartamento, setFiltroDepartamento] = useState('TODOS');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [estacionSeleccionada, setEstacionSeleccionada] = useState<EstacionOCM | null>(null);
  const [infoRuta, setInfoRuta] = useState<string | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);
  const [navegando, setNavegando] = useState(false);
  const [navegacionPausada, setNavegacionPausada] = useState(false);
  const [distanciaRestante, setDistanciaRestante] = useState<number | null>(null);
  const [proximaInstruccion, setProximaInstruccion] = useState('');
  const [rumbo, setRumbo] = useState<number | null>(null);
  const [desvioRuta, setDesvioRuta] = useState(false);
  const [vehiculosUsuario, setVehiculosUsuario] = useState<Vehiculo[]>([]);
  const [vehiculoFiltroId, setVehiculoFiltroId] = useState('');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const rutaCoordsRef = useRef<[number, number][]>([]);
  const destinoRutaRef = useRef<[number, number] | null>(null);
  const instruccionesRef = useRef<Array<{ nombre: string; modificador: string; distancia_m: number }>>([]);
  const recalculandoRutaRef = useRef(false);
  const ultimaPosicionRef = useRef<[number, number] | null>(null);
  const simulacionRef = useRef<number | null>(null);
  const [simulandoNavegacion, setSimulandoNavegacion] = useState(false);

  const actualizarTrayectoRecorrido = (indice: number) => {
    const map = mapRef.current;
    const todosLosPuntos = rutaCoordsRef.current;
    const fin = Math.min(Math.max(0, indice), todosLosPuntos.length - 1);
    const puntos = todosLosPuntos.slice(0, Math.max(2, fin + 1));
    if (!map || puntos.length < 2) return;
    if (!rutaRecorridaRef.current) {
      rutaRecorridaRef.current = L.polyline(puntos, { color: '#8b949e', weight: 8, opacity: 0.95 }).addTo(map);
      return;
    }
    rutaRecorridaRef.current.setLatLngs(puntos);
  };

  const distanciaKm = (a: [number, number], b: [number, number]) => {
    const radio = 6371;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLon = (b[1] - a[1]) * Math.PI / 180;
    const lat1 = a[0] * Math.PI / 180;
    const lat2 = b[0] * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return radio * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const calcularRumbo = (origen: [number, number], destino: [number, number]) => {
    const lat1 = origen[0] * Math.PI / 180;
    const lat2 = destino[0] * Math.PI / 180;
    const deltaLon = (destino[1] - origen[1]) * Math.PI / 180;
    const y = Math.sin(deltaLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  const actualizarPosicion = (pos: GeolocationPosition) => {
    const actual: [number, number] = [pos.coords.latitude, pos.coords.longitude];
    if (!usuarioMarcadorRef.current || !mapRef.current) return;
    // Android puede entregar primero una ubicación de red muy imprecisa.
    // No movemos el punto ni el mapa hasta recibir una coordenada confiable.
    if (!Number.isFinite(pos.coords.accuracy) || pos.coords.accuracy > PRECISION_GPS_MAXIMA_METROS) return;
    const posicionAnterior = ultimaPosicionRef.current;
    if (posicionAnterior && distanciaKm(actual, posicionAnterior) < 0.008) return;
    const rumboGps = pos.coords.heading;
    if (typeof rumboGps === 'number' && Number.isFinite(rumboGps) && rumboGps >= 0 && (pos.coords.speed == null || pos.coords.speed > 0.5)) {
      setRumbo(rumboGps);
      usuarioMarcadorRef.current.setIcon(crearIconoUbicacion(rumboGps));
    } else if (posicionAnterior) {
      const rumboCalculado = calcularRumbo(posicionAnterior, actual);
      setRumbo(rumboCalculado);
      usuarioMarcadorRef.current.setIcon(crearIconoUbicacion(rumboCalculado));
    }
    ultimaPosicionRef.current = actual;
    usuarioMarcadorRef.current.setLatLng(actual);
    if (rutaCoordsRef.current.length && mapRef.current.getZoom() >= 13) {
      mapRef.current.setView(actual, mapRef.current.getZoom(), { animate: false });
    }
    const puntos = rutaCoordsRef.current;
    if (!puntos.length) return;
    let indiceCercano = 0;
    let distanciaCercana = Number.POSITIVE_INFINITY;
    puntos.forEach((punto, indice) => {
      const distancia = distanciaKm(actual, punto);
      if (distancia < distanciaCercana) { distanciaCercana = distancia; indiceCercano = indice; }
    });
    actualizarTrayectoRecorrido(indiceCercano);
    const destino = destinoRutaRef.current;
    if (destino) setDistanciaRestante(Math.max(0, distanciaKm(actual, destino)));
    const estaDesviado = distanciaCercana > 0.5;
    setDesvioRuta(estaDesviado);
    if (estaDesviado && destino && !recalculandoRutaRef.current) {
      recalculandoRutaRef.current = true;
      planificarViaje(actual[0], actual[1], destino[0], destino[1], 300)
        .then((plan) => {
          if (!mapRef.current) return;
          if (rutaCapaRef.current) mapRef.current.removeLayer(rutaCapaRef.current);
          if (rutaRecorridaRef.current) mapRef.current.removeLayer(rutaRecorridaRef.current);
          rutaRecorridaRef.current = null;
          const nuevaCapa = L.geoJSON(plan.geometry as GeoJSON.GeoJsonObject, { style: { color: '#1769ff', weight: 7, opacity: 0.95 } }).addTo(mapRef.current);
          rutaCapaRef.current = nuevaCapa;
          rutaCoordsRef.current = plan.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          instruccionesRef.current = (plan.instrucciones || []).map((paso) => ({ nombre: paso.nombre, modificador: paso.modificador, distancia_m: paso.distancia_m }));
          setInfoRuta(`Ruta recalculada: ${plan.distancia_total_km} km · Tiempo: ${plan.duracion_min} min`);
          setDesvioRuta(false);
        })
        .catch(() => setInfoRuta('No se pudo recalcular la ruta. Puedes intentarlo nuevamente.'))
        .finally(() => { recalculandoRutaRef.current = false; });
    }
    const instruccion = instruccionesRef.current.find((_, indice) => indice >= indiceCercano / Math.max(1, puntos.length) * instruccionesRef.current.length);
    if (instruccion) {
      const giro = instruccion.modificador ? `, ${instruccion.modificador}` : '';
      setProximaInstruccion(`Continúa por ${instruccion.nombre}${giro}`);
    }
    if (destino && distanciaKm(actual, destino) < 0.05) {
      setProximaInstruccion('Has llegado a la estación.');
    }
  };

  const detenerNavegacion = (limpiarRuta = false) => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (simulacionRef.current !== null) window.clearInterval(simulacionRef.current);
    watchIdRef.current = null;
    simulacionRef.current = null;
    setSimulandoNavegacion(false);
    setNavegando(false);
    setNavegacionPausada(false);
    if (limpiarRuta && mapRef.current) {
      if (rutaCapaRef.current) mapRef.current.removeLayer(rutaCapaRef.current);
      if (rutaRecorridaRef.current) mapRef.current.removeLayer(rutaRecorridaRef.current);
      if (usuarioMarcadorRef.current) mapRef.current.removeLayer(usuarioMarcadorRef.current);
      rutaCapaRef.current = null;
      rutaRecorridaRef.current = null;
      usuarioMarcadorRef.current = null;
      rutaCoordsRef.current = [];
      destinoRutaRef.current = null;
      setInfoRuta(null);
      setDistanciaRestante(null);
      setProximaInstruccion('');
      setRumbo(null);
      setDesvioRuta(false);
    }
  };

  useEffect(() => {
    if (!navegando) return;
    const actualizarOrientacion = (evento: Event) => {
      const datos = evento as DeviceOrientationEvent;
      if (evento.type !== 'deviceorientationabsolute' || datos.absolute !== true) return;
      const datosConBrújula = datos as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const rumboBrújula = datosConBrújula.webkitCompassHeading;
      if (typeof rumboBrújula === 'number' && Number.isFinite(rumboBrújula)) {
        setRumbo(rumboBrújula);
        usuarioMarcadorRef.current?.setIcon(crearIconoUbicacion(rumboBrújula));
      } else if (typeof datos.alpha === 'number' && Number.isFinite(datos.alpha)) {
        const giroPantalla = Number(window.screen.orientation?.angle || 0);
        const nuevoRumbo = (360 - datos.alpha + giroPantalla) % 360;
        setRumbo(nuevoRumbo);
        usuarioMarcadorRef.current?.setIcon(crearIconoUbicacion(nuevoRumbo));
      }
    };
    window.addEventListener('deviceorientationabsolute', actualizarOrientacion);
    return () => {
      window.removeEventListener('deviceorientationabsolute', actualizarOrientacion);
    };
  }, [navegando]);

  const iniciarNavegacion = () => {
    if (!navigator.geolocation || !rutaCoordsRef.current.length) return;
    if (simulacionRef.current !== null) window.clearInterval(simulacionRef.current);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    ultimaPosicionRef.current = null;
    setSimulandoNavegacion(false);
    setNavegando(true);
    setNavegacionPausada(false);
      watchIdRef.current = navigator.geolocation.watchPosition(actualizarPosicion, () => {
      setInfoRuta('No se pudo actualizar tu ubicación. Revisa el permiso de GPS.');
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
  };

  const iniciarSimulacion = () => {
    if (!rutaCoordsRef.current.length || !mapRef.current || !usuarioMarcadorRef.current) return;
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (simulacionRef.current !== null) window.clearInterval(simulacionRef.current);
    let indice = 0;
    usuarioMarcadorRef.current.setIcon(crearIconoUbicacion(rumbo || 0));
    setNavegando(true);
    setNavegacionPausada(false);
    setSimulandoNavegacion(true);
    simulacionRef.current = window.setInterval(() => {
      const punto = rutaCoordsRef.current[indice];
      const destino = destinoRutaRef.current;
      if (!punto || !destino || !usuarioMarcadorRef.current) {
        detenerNavegacion(false);
        return;
      }
      usuarioMarcadorRef.current.setLatLng(punto);
      actualizarTrayectoRecorrido(indice);
      setDistanciaRestante(distanciaKm(punto, destino));
      setInfoRuta('Navegación de prueba activa · ubicación simulada');
      indice += Math.max(1, Math.ceil(rutaCoordsRef.current.length / 35));
      if (indice >= rutaCoordsRef.current.length) {
        if (simulacionRef.current !== null) window.clearInterval(simulacionRef.current);
        simulacionRef.current = null;
        actualizarTrayectoRecorrido(rutaCoordsRef.current.length - 1);
        setSimulandoNavegacion(false);
        setNavegando(false);
        setProximaInstruccion('Prueba finalizada: llegaste a la estación.');
      }
    }, 1000);
  };

  useEffect(() => () => detenerNavegacion(), []);

  useEffect(() => {
    if (!usuario || usuario.is_admin) {
      setVehiculosUsuario([]);
      setVehiculoFiltroId('');
      return;
    }
    listarVehiculos()
      .then((vehiculos) => {
        const activos = vehiculos.filter((vehiculo) => vehiculo.activo !== false);
        setVehiculosUsuario(activos);
        setVehiculoFiltroId((actual) => actual && activos.some((vehiculo) => vehiculo.id === actual) ? actual : activos[0]?.id || '');
      })
      .catch(() => setVehiculosUsuario([]));
  }, [usuario]);

  useEffect(() => {
    document.body.classList.add('map-page');
    const esDispositivoMovil = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || Boolean((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile);
    if (esDispositivoMovil) document.body.classList.add('map-mobile-device');
    return () => {
      document.body.classList.remove('map-page');
      document.body.classList.remove('map-mobile-device');
    };
  }, []);

  useEffect(() => {
    const stationId = new URLSearchParams(location.search).get('estacion');
    if (!stationId || !mapRef.current) return;
    const station = estaciones.find((item) => String(item.ID) === stationId);
    if (!station?.AddressInfo) return;
    setEstacionSeleccionada(station);
    mapRef.current.setView([station.AddressInfo.Latitude, station.AddressInfo.Longitude], 15);
  }, [estaciones, location.search]);

  const abrirAuthModal = (tab: AuthTab) => {
    setAuthTab(tab);
    setAuthModalOpen(true);
  };

  const cerrarSesion = () => {
    logout();
    navigate('/');
  };

  // Inicializa el mapa una sola vez y carga las estaciones de OpenChargeMap.
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      minZoom: 5,
      maxBounds: LIMITES_COLOMBIA,
      maxBoundsViscosity: 1,
      zoomControl: false,
    }).setView(BOGOTA, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      noWrap: true,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;

    const invalidarTamanoMapa = () => {
      window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };
    const observadorTamano = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(invalidarTamanoMapa)
      : null;
    observadorTamano?.observe(mapDivRef.current);
    window.addEventListener('resize', invalidarTamanoMapa);
    invalidarTamanoMapa();

    const cargarEstaciones = () => {
      const cargar = (url: string, params?: Record<string, number>) => api.get<EstacionOCM[]>(url, { params });
      const solicitud = cargar('/estaciones-mapa');
      const cacheKey = 'ev-charge:estaciones:nacional';
      const mostrarEstaciones = (data: EstacionOCM[], guardar = false) => {
        const validas = data.filter((estacion) => {
          const lat = estacion.AddressInfo?.Latitude;
          const lon = estacion.AddressInfo?.Longitude;
          return Number.isFinite(lat) && Number.isFinite(lon);
        });
        setEstaciones(validas);
        if (guardar) {
          try { window.localStorage.setItem(cacheKey, JSON.stringify(validas)); } catch { /* La cache es opcional. */ }
        }
        if (validas.length && !mapaAjustadoInicialmenteRef.current) {
          const puntos = validas.map((estacion) => [
            estacion.AddressInfo!.Latitude,
            estacion.AddressInfo!.Longitude,
          ] as [number, number]);
          map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 14 });
          mapaAjustadoInicialmenteRef.current = true;
        }
      };
      try {
        const cache = window.localStorage.getItem(cacheKey);
        if (cache) mostrarEstaciones(JSON.parse(cache) as EstacionOCM[]);
      } catch { /* Si la cache está dañada, se ignora y se usa la API. */ }
      solicitud
        .then(({ data }) => {
          mostrarEstaciones(data, true);
        })
        .catch((e: Error) => {
          console.error('Error cargando estaciones:', e);
        });
    };

    cargarEstaciones();
    const actualizarMapa = () => cargarEstaciones();
    const actualizarMapaStorage = (evento: StorageEvent) => {
      if (evento.key === 'ev-charge:estaciones-actualizadas') cargarEstaciones();
    };
    window.addEventListener('ev-charge:estaciones-actualizadas', actualizarMapa);
    window.addEventListener('storage', actualizarMapaStorage);

    return () => {
      window.removeEventListener('ev-charge:estaciones-actualizadas', actualizarMapa);
      window.removeEventListener('storage', actualizarMapaStorage);
      window.removeEventListener('resize', invalidarTamanoMapa);
      observadorTamano?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [usuario?.is_admin]);

  useEffect(() => {
    if (!estaciones.length) return;
    let cancelado = false;
    const cargarEstados = () => {
      const limites = mapRef.current?.getBounds();
      const visibles = limites
        ? estaciones.filter((estacion) => estacion.AddressInfo && limites.contains([estacion.AddressInfo.Latitude, estacion.AddressInfo.Longitude]))
        : estaciones;
      const objetivo = visibles.slice(0, usuario ? 80 : 40);
      Promise.all(objetivo.map(async (estacion) => {
        const id = String(estacion.ID);
        try {
          const estado = await obtenerEstadoEstacion(id);
          return [id, { estado: String(estado.estado || 'disponible'), cargadores_reservados: estado.cargadores_reservados }] as const;
        } catch {
          return [id, { estado: 'disponible' }] as const;
        }
      })).then((resultados) => {
        if (!cancelado) setEstadosEstaciones(Object.fromEntries(resultados));
      });
    };
    cargarEstados();
    const intervalo = window.setInterval(cargarEstados, 30000);
    const actualizarEstado = (evento: Event) => {
      const detalle = (evento as CustomEvent<{ estacionId?: string; cargadorId?: string }>).detail;
      if (detalle?.estacionId && detalle.cargadorId) {
        setEstadosEstaciones((actuales) => {
          const anterior = actuales[detalle.estacionId!] || { estado: 'disponible' };
          const cargadores = new Set(anterior.cargadores_reservados || []);
          cargadores.add(detalle.cargadorId!);
          return {
            ...actuales,
            [detalle.estacionId!]: { ...anterior, cargadores_reservados: [...cargadores] },
          };
        });
      }
      void cargarEstados();
    };
    const actualizarEstadoStorage = (evento: StorageEvent) => {
      if (evento.key === 'ev-charge:estaciones-actualizadas') cargarEstados();
    };
    window.addEventListener('ev-charge:estaciones-actualizadas', actualizarEstado);
    window.addEventListener('storage', actualizarEstadoStorage);
    return () => {
      cancelado = true;
      window.clearInterval(intervalo);
      window.removeEventListener('ev-charge:estaciones-actualizadas', actualizarEstado);
      window.removeEventListener('storage', actualizarEstadoStorage);
    };
  }, [estaciones, usuario]);

  // Recalcula los marcadores visibles cuando cambian las estaciones o el filtro.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    marcadoresRef.current.forEach((m) => map.removeLayer(m));
    marcadoresRef.current = [];
    marcadorSeleccionadoRef.current = null;

    const vehiculoActivo = vehiculosUsuario.find((vehiculo) => vehiculo.id === vehiculoFiltroId);
    const estacionesPorVehiculo = vehiculoActivo
      ? estaciones.filter((st) => (st.Connections || []).some((conector) =>
          (conector.ConnectionType?.Title || '').toLowerCase().includes(vehiculoActivo.tipo_conector.toLowerCase()),
        ))
      : estaciones;
    const estacionesPorDepartamento = filtroDepartamento === 'TODOS'
      ? estacionesPorVehiculo
      : estacionesPorVehiculo.filter((st) => departamentoCanonico(st.departamento || st.StateOrProvince || st.AddressInfo?.StateOrProvince) === filtroDepartamento);
    const lista = filtro === 'TODOS'
      ? estacionesPorDepartamento
      : estacionesPorDepartamento.filter((st) =>
          (st.Connections || []).some((c) => (c.ConnectionType?.Title || '').toLowerCase().includes(filtro.toLowerCase())),
        );

    lista.forEach((st) => {
      if (!st.AddressInfo) return;
      const id = String(st.ID);
      const estadoInfo = estadosEstaciones[id] || { estado: 'disponible' };
      const conexionesCompatibles = (st.Connections || []).filter((conector) => {
        const tipo = (conector.ConnectionType?.Title || '').toLowerCase();
        const porFiltro = filtro === 'TODOS' || tipo.includes(filtro.toLowerCase());
        const vehiculoActivo = vehiculosUsuario.find((vehiculo) => vehiculo.id === vehiculoFiltroId);
        const porVehiculo = !vehiculoActivo || tipo.includes(vehiculoActivo.tipo_conector.toLowerCase());
        return porFiltro && porVehiculo;
      });
      const idsCargadoresCompatibles = conexionesCompatibles.map((conector) => `${id}-${(st.Connections || []).indexOf(conector) + 1}`);
      const todosCompatiblesReservados = idsCargadoresCompatibles.length > 0 && idsCargadoresCompatibles.every((cargadorId) => estadoInfo.cargadores_reservados?.includes(cargadorId));
      const estado = estadoInfo.estado === 'disponible' && todosCompatiblesReservados ? 'reservada' : estadoInfo.estado;
      const marker = L.marker([st.AddressInfo.Latitude, st.AddressInfo.Longitude], { icon: crearIconoEstacion(estado, false) }).addTo(map);
      marker.bindTooltip(st.AddressInfo.Title || `Estación ${id}`, { direction: 'top', offset: [0, -12], sticky: true });
      marker.on('click', () => {
        const anterior = marcadorSeleccionadoRef.current;
        if (anterior && anterior !== marker) {
          const extendido = anterior as L.Marker & { estadoEstacion?: string };
          anterior.setIcon(crearIconoEstacion(extendido.estadoEstacion || 'disponible', false));
        }
        marker.setIcon(crearIconoEstacion(estado, true));
        marcadorSeleccionadoRef.current = marker;
        setEstacionSeleccionada(st);
        setInfoRuta(null);
      });
      (marker as L.Marker & { estadoEstacion?: string }).estadoEstacion = estado;
      marcadoresRef.current.push(marker);
    });
  }, [estaciones, estadosEstaciones, filtro, filtroDepartamento, vehiculosUsuario, vehiculoFiltroId]);

  const departamentosDisponibles = Array.from(new Map(
    estaciones
      .map((st) => departamentoCanonico(st.departamento || st.StateOrProvince || st.AddressInfo?.StateOrProvince))
      .filter(Boolean)
      .map((departamento) => [departamento, departamento] as const),
  ).values()).sort();

  const calcularRuta = (destLat: number, destLon: number) => {
    if (!navigator.geolocation) return notificar({ tipo: 'error', titulo: 'Ubicación', mensaje: 'Este dispositivo no tiene GPS disponible.' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const map = mapRef.current;
        if (!map) return;
        if (!Number.isFinite(pos.coords.accuracy) || pos.coords.accuracy > PRECISION_GPS_MAXIMA_METROS) {
          notificar({ tipo: 'warning', titulo: 'Ubicación', mensaje: 'El GPS todavía no tiene suficiente precisión. Espera unos segundos y vuelve a intentarlo.' });
          return;
        }
        const { latitude: uLat, longitude: uLon } = pos.coords;

        if (rutaCapaRef.current) map.removeLayer(rutaCapaRef.current);
        if (rutaRecorridaRef.current) map.removeLayer(rutaRecorridaRef.current);
        rutaRecorridaRef.current = null;
        if (usuarioMarcadorRef.current) map.removeLayer(usuarioMarcadorRef.current);
        const rumboInicial = typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading) && pos.coords.heading >= 0 ? pos.coords.heading : 0;
        setRumbo(rumboInicial);
        usuarioMarcadorRef.current = L.marker([uLat, uLon], { icon: crearIconoUbicacion(rumboInicial) }).addTo(map);

        setCargandoRuta(true);
        try {
          const plan = await planificarViaje(uLat, uLon, destLat, destLon, 300);

          // Mostrar la ruta en el mapa
          const capa = L.geoJSON(plan.geometry as GeoJSON.GeoJsonObject, {
            style: { color: '#1769ff', weight: 7, opacity: 0.95 },
          }).addTo(map);
          rutaCapaRef.current = capa;
          rutaCoordsRef.current = plan.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
          destinoRutaRef.current = [destLat, destLon];
          instruccionesRef.current = (plan.instrucciones || []).map((paso) => ({ nombre: paso.nombre, modificador: paso.modificador, distancia_m: paso.distancia_m }));
          map.fitBounds(capa.getBounds(), { padding: [50, 50] });

          let infoTexto = `Distancia: ${plan.distancia_total_km} km · Tiempo: ${plan.duracion_min} min`;
          if (plan.paradas_sugeridas > 0) {
            infoTexto += ` · ${plan.paradas_sugeridas} parada(s) sugerida(s)`;
          }

          setInfoRuta(infoTexto);
          setDistanciaRestante(distanciaKm([uLat, uLon], [destLat, destLon]));
          iniciarNavegacion();
        } catch {
          notificar({ tipo: 'error', titulo: 'Ruta', mensaje: 'No se pudo calcular la ruta. Verifica que el backend esté activo.' });
        } finally {
          setCargandoRuta(false);
        }
      },
      (error) => notificar({ tipo: 'warning', titulo: 'Ubicación', mensaje: error.code === error.PERMISSION_DENIED ? 'Permiso de ubicación denegado. Actívalo en el navegador para usar el GPS.' : 'No se pudo obtener una ubicación precisa.' }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
  };

  const irAMiUbicacion = () => {
    if (!navigator.geolocation) {
      notificar({ tipo: 'error', titulo: 'Ubicación', mensaje: 'Este dispositivo no tiene GPS disponible.' });
      return;
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      notificar({ tipo: 'warning', titulo: 'Ubicación bloqueada', mensaje: 'El navegador del celular solo permite el GPS por HTTPS. Abre EV Charge con una conexión segura o prueba desde localhost.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!Number.isFinite(pos.coords.accuracy) || pos.coords.accuracy > PRECISION_GPS_MAXIMA_METROS) {
          notificar({ tipo: 'warning', titulo: 'Ubicación', mensaje: 'No se pudo obtener una ubicación válida. Activa el GPS y vuelve a intentarlo.' });
          return;
        }
        const actual: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        const map = mapRef.current;
        if (!map) return;
        if (!usuarioMarcadorRef.current) {
        usuarioMarcadorRef.current = L.marker(actual, { icon: crearIconoUbicacion(rumbo || 0) }).addTo(map);
        } else {
          usuarioMarcadorRef.current.setLatLng(actual);
        }
        map.closePopup();
        map.setView(actual, Math.max(map.getZoom(), 15), { animate: true });
      },
      (error) => {
        const mensaje = error.code === error.PERMISSION_DENIED
          ? 'Permiso de ubicación denegado. Activa la ubicación para Chrome y vuelve a intentarlo.'
          : error.code === error.TIMEOUT
            ? 'El GPS tardó demasiado. Activa la ubicación del celular y vuelve a intentarlo en un lugar abierto.'
            : 'No se pudo obtener tu ubicación. Revisa el GPS y el permiso del navegador.';
        notificar({ tipo: 'warning', titulo: 'Ubicación', mensaje });
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
  };

  const nombreCompleto = usuario ? (usuario.apellido ? `${usuario.nombre} ${usuario.apellido}` : usuario.nombre) : '';
  const filtrosActivos = [filtro !== 'TODOS', filtroDepartamento !== 'TODOS', Boolean(vehiculoFiltroId)].filter(Boolean).length;

  return (
    <>
      {/* TOPBAR */}
      <div id="topbar">
        <div className="topbar-left">
          <Link to="/" className="topbar-back"><i className="fa-solid fa-arrow-left"></i> Inicio</Link>
          <button className="menu-toggle" aria-label="Abrir menú" onClick={() => setDrawerOpen(true)}>
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>
        <div className="topbar-center">
          <Link to="/" className="topbar-logo"><img src="/img/logo.png" alt="EV Charge" /><span className="topbar-project-name">EV CHARGE</span></Link>
        </div>
        <div className="topbar-right">
          <button
            type="button"
            className={`map-help-button${ayudaAbierta ? ' active' : ''}`}
            onClick={() => setAyudaAbierta((abierta) => !abierta)}
            aria-label="Cómo usar EV Charge"
            title="Cómo usar EV Charge"
          >
            <i className="fa-solid fa-question"></i>
          </button>
          <div className="map-filters-wrap">
            <button className={`map-filters-button${filtrosActivos ? ' has-active' : ''}`} type="button" onClick={() => setFiltrosAbiertos((abierto) => !abierto)} aria-expanded={filtrosAbiertos}>
              <i className="fa-solid fa-sliders"></i> Filtros{filtrosActivos > 0 && <span className="filter-count">{filtrosActivos}</span>}
            </button>
            {filtrosAbiertos && <div className="map-filters-panel">
              <div className="map-filters-header"><strong>Filtrar estaciones</strong><button type="button" className="map-filters-close" onClick={() => setFiltrosAbiertos(false)} aria-label="Cerrar filtros">×</button></div>
              <label>Tipo de conector<select className="filter-select" title="Filtrar por tipo de conector" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="TODOS">Todos los conectores</option><option value="CCS">CCS</option><option value="Type 2">Type 2</option><option value="CHAdeMO">CHAdeMO</option><option value="GB/T">GB/T</option><option value="J1772">J1772</option>
              </select></label>
              <label>Departamento<select className="filter-select" title="Filtrar por departamento" value={filtroDepartamento} onChange={(e) => setFiltroDepartamento(e.target.value)}>
                <option value="TODOS">Todos los departamentos</option>{departamentosDisponibles.map((departamento) => <option key={departamento} value={departamento}>{departamento}</option>)}
              </select></label>
              {usuario && !usuario.is_admin && vehiculosUsuario.length > 0 && <label>Vehículo<select className="filter-select" title="Filtrar estaciones por vehículo" value={vehiculoFiltroId} onChange={(e) => setVehiculoFiltroId(e.target.value)}><option value="">Todos los vehículos</option>{vehiculosUsuario.map((vehiculo) => <option key={vehiculo.id} value={vehiculo.id}>{vehiculo.marca} {vehiculo.modelo} · {vehiculo.tipo_conector}</option>)}</select></label>}
              {filtrosActivos > 0 && <button type="button" className="map-filters-clear" onClick={() => { setFiltro('TODOS'); setFiltroDepartamento('TODOS'); setVehiculoFiltroId(''); }}>Limpiar filtros</button>}
            </div>}
          </div>
          {usuario ? (
            <>
              <span style={{ fontSize: 13, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{nombreCompleto}</span>
                <span
                  style={{
                    background: usuario.is_admin ? 'rgba(57,169,0,0.15)' : 'rgba(255,255,255,0.05)',
                    color: usuario.is_admin ? '#39a900' : '#999',
                    padding: '2px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {usuario.is_admin ? 'Admin' : usuario.rol === 'empresa' ? 'Empresa' : 'Usuario'}
                </span>
              </span>
              <button className="btn-topbar-logout" onClick={cerrarSesion}>Salir</button>
            </>
          ) : (
            <>
              <button className="btn-topbar-login" onClick={() => abrirAuthModal('login')}>Iniciar sesión</button>
              <button className="btn-topbar-registro" onClick={() => abrirAuthModal('registro')}>Registrarse</button>
            </>
          )}
        </div>
      </div>

      {/* MAPA + PANEL LATERAL */}
      <div id="map-wrapper">
        <div id="map" ref={mapDivRef}></div>
        <div className="map-controls" aria-label="Controles del mapa">
          <button type="button" onClick={() => mapRef.current?.zoomIn()} aria-label="Acercar mapa" title="Acercar mapa">+</button>
          <button type="button" onClick={() => mapRef.current?.zoomOut()} aria-label="Alejar mapa" title="Alejar mapa">−</button>
          <button type="button" onClick={irAMiUbicacion} aria-label="Ir a mi ubicación" title="Ir a mi ubicación">
            <i className="fa-solid fa-location-crosshairs"></i>
          </button>
        </div>
        {ayudaAbierta && <section className="map-help-panel" aria-label="Cómo usar EV Charge">
          <div className="map-help-header">
            <strong>¿Cómo usar EV Charge?</strong>
            <button type="button" onClick={() => setAyudaAbierta(false)} aria-label="Cerrar ayuda">×</button>
          </div>
          <ol className="map-help-list">
            <li><i className="fa-solid fa-hand-pointer"></i><span>Toca un marcador para ver la estación.</span></li>
            <li><i className="fa-solid fa-sliders"></i><span>Usa los filtros para buscar por conector o departamento.</span></li>
            <li><i className="fa-solid fa-location-crosshairs"></i><span>Usa ubicación para centrar el mapa en ti.</span></li>
            <li><i className="fa-solid fa-route"></i><span>Desde una estación puedes calcular una ruta o reservar.</span></li>
          </ol>
        </section>}
        <div id="panel-lateral">
          <div className="panel-scroll">
            <div className="panel-card welcome-card">
              <div className="welcome-icon"><i className="fa-solid fa-map"></i></div>
              <h2 className="welcome-title">Explora el mapa de EV Charge</h2>
              <p className="welcome-text">
                Utiliza el mapa para localizar estaciones de carga, consultar información y encontrar la mejor opción para tu próximo recorrido.
              </p>
            </div>
            <div className="panel-card steps-card">
              <h3 className="card-title">¿Cómo utilizar el mapa?</h3>
              <div className="steps-grid">
                {[
                  ['fa-location-dot', 'Explora el mapa'],
                  ['fa-bolt', 'Selecciona una estación'],
                  ['fa-plug', 'Usa los filtros'],
                  ['fa-calendar-days', 'Realiza una reserva'],
                  ['fa-compass', 'Planifica tu recorrido'],
                ].map(([icon, label]) => (
                  <div className="step-item" key={label}>
                    <span className="step-icon"><i className={`fa-solid ${icon}`}></i></span>
                    <span className="step-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card tips-card">
              <h3 className="card-title"><i className="fa-solid fa-lightbulb"></i> Consejos para una mejor experiencia</h3>
              <ul className="tips-list">
                <li>Activa tu ubicación para encontrar estaciones cercanas.</li>
                <li>Revisa el tipo de conector antes de seleccionar una estación.</li>
                <li>Consulta la disponibilidad antes de realizar una reserva.</li>
                <li>Utiliza el zoom del mapa para visualizar más estaciones.</li>
                <li>Explora diferentes zonas para encontrar la opción que mejor se adapte a tu recorrido.</li>
              </ul>
            </div>
            <div className="panel-card map-legend-card">
              <h3 className="card-title">Estado de las estaciones</h3>
              <p><span style={{ color: '#39a900' }}>●</span> Disponible</p>
              <p><span style={{ color: '#3498db' }}>●</span> Reservada</p>
              <p><span style={{ color: '#f39c12' }}>●</span> En mantenimiento</p>
              <p><span style={{ color: '#e74c3c' }}>●</span> Fuera de servicio</p>
            </div>
          </div>
        </div>

        <div id="estacion-detalle" className={`estacion-detalle${estacionSeleccionada ? ' open' : ''}`}>
          <button className="close-detalle" onClick={() => setEstacionSeleccionada(null)}><i className="fa-solid fa-xmark"></i></button>
          <div id="detalle-contenido">
            {estacionSeleccionada && (
              <EstacionDetalle
                estacion={estacionSeleccionada}
                usuario={usuario}
                onLoginRequerido={() => abrirAuthModal('login')}
                onRegistroRequerido={() => abrirAuthModal('registro')}
                onCalcularRuta={calcularRuta}
                onClose={() => setEstacionSeleccionada(null)}
                filtroConector={filtro}
                tipoConectorVehiculo={vehiculosUsuario.find((vehiculo) => vehiculo.id === vehiculoFiltroId)?.tipo_conector || ''}
                tieneVehiculo={vehiculosUsuario.length > 0}
                onRegistrarVehiculo={() => navigate('/dashboard?panel=Veh%C3%ADculos')}
              />
            )}
            {infoRuta && (
              <div style={{ margin: '8px 0', padding: 8, background: '#1a1a1a', borderRadius: 6, border: '2px solid #39a900', color: '#39a900', fontSize: 13, fontWeight: 600 }}>
                <i className="fa-solid fa-car"></i> {infoRuta}
                {navegando && <div style={{ marginTop: 6, color: '#fff' }}>Navegación activa · {distanciaRestante === null ? 'calculando distancia' : `${distanciaRestante.toFixed(1)} km restantes`}</div>}
                {proximaInstruccion && <div style={{ marginTop: 4, color: '#ddd' }}><i className="fa-solid fa-signs-post"></i> {proximaInstruccion}</div>}
                {desvioRuta && <div style={{ marginTop: 4, color: '#f39c12' }}>Te alejaste de la ruta. Se recomienda recalcular.</div>}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn-tbl" onClick={iniciarSimulacion}>{simulandoNavegacion ? 'Prueba activa' : 'Probar simulación'}</button>
                  {navegando && <button className="btn-tbl" onClick={() => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; setNavegando(false); setNavegacionPausada(true); }}>Pausar</button>}
                  {navegacionPausada && <button className="btn-tbl" onClick={iniciarNavegacion}>Continuar</button>}
                  {(navegando || navegacionPausada) && <button className="btn-tbl danger" onClick={() => detenerNavegacion(false)}>Finalizar navegación</button>}
                </div>
              </div>
            )}
            {cargandoRuta && (
              <div style={{ margin: '8px 0', padding: 8, background: '#1a1a1a', borderRadius: 6, border: '2px solid #f39c12', color: '#f39c12', fontSize: 13, textAlign: 'center' }}>
                <i className="fa-solid fa-spinner fa-spin"></i> Calculando ruta...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DRAWER — MENÚ ADAPTATIVO */}
      <div className={`drawer-overlay${drawerOpen ? ' open' : ''}`} onClick={() => setDrawerOpen(false)}></div>
      <div className={`drawer${drawerOpen ? ' open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-avatar">{usuario ? usuario.nombre.charAt(0).toUpperCase() : <i className="fa-solid fa-user"></i>}</div>
          <div className="drawer-user-info">
            <div className="drawer-user-name">{usuario ? nombreCompleto : 'Invitado'}</div>
            <div className="drawer-user-email">{usuario ? usuario.email : 'Inicia sesión para acceder a todas las funciones de EV Charge.'}</div>
            <div className="drawer-user-role" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {usuario ? (usuario.is_admin ? 'Administrador' : usuario.rol === 'empresa' ? 'Empresa' : 'Usuario') : '—'}
            </div>
          </div>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}><i className="fa-solid fa-xmark"></i></button>
        </div>
        <nav className="drawer-nav">
          {!usuario ? (
            <>
              <Link className="anav" to="/" onClick={() => setDrawerOpen(false)}><span className="icon"><i className="fa-solid fa-house"></i></span> Inicio</Link>
              <a className="anav" href="#" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); abrirAuthModal('login'); }}><span className="icon"><i className="fa-solid fa-key"></i></span> Iniciar sesión</a>
              <a className="anav" href="#" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); abrirAuthModal('registro'); }}><span className="icon"><i className="fa-solid fa-user-plus"></i></span> Registrarse</a>
            </>
          ) : usuario.is_admin ? (
            <>
              <Link className="anav" to="/admin" onClick={() => setDrawerOpen(false)}><span className="icon"><i className="fa-solid fa-chart-simple"></i></span> Panel admin</Link>
              <a className="anav danger" href="#" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); cerrarSesion(); }}><span className="icon"><i className="fa-solid fa-right-from-bracket"></i></span> Cerrar sesión</a>
            </>
          ) : usuario.rol === 'empresa' ? (
            <>
              <Link className="anav" to="/empresa" onClick={() => setDrawerOpen(false)}><span className="icon"><i className="fa-solid fa-building"></i></span> Panel de empresa</Link>
              <a className="anav danger" href="#" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); cerrarSesion(); }}><span className="icon"><i className="fa-solid fa-right-from-bracket"></i></span> Cerrar sesión</a>
            </>
          ) : (
            <>
              <Link className="anav" to="/dashboard" onClick={() => setDrawerOpen(false)}><span className="icon"><i className="fa-solid fa-house"></i></span> Mi dashboard</Link>
              <a className="anav danger" href="#" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); cerrarSesion(); }}><span className="icon"><i className="fa-solid fa-right-from-bracket"></i></span> Cerrar sesión</a>
            </>
          )}
        </nav>
      </div>

      {authModalOpen && <AuthModal initialTab={authTab} onClose={() => setAuthModalOpen(false)} />}
    </>
  );
}
