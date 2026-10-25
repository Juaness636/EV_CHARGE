// Mapa de estaciones (equivale a MapaPage.tsx del web): filtros por conector, departamento
// y vehículo, estado en vivo de cada estación, detalle, rutas y navegación GPS.
// En PC muestra un panel lateral; en celular, el detalle aparece como hoja inferior.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listarEstacionesMapa } from '../../api/mapa.api';
import { obtenerEstadosLote } from '../../api/estado.api';
import { listarVehiculos, type Vehiculo } from '../../api/vehiculos.api';
import { nombreCompleto, rutaPanel, useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import { coloresEstado, type Palette } from '../../theme/colors';
import { BREAKPOINT_ESCRITORIO, Radius, Spacing } from '../../theme/spacing';
import { escuchar } from '../../utils/eventos';
import { conectorCoincide, departamentoDe, nombreEstacion, TIPOS_CONECTOR } from '../../utils/estaciones';
import { BarraSuperior } from '../../components/BarraSuperior';
import { notificar } from '../../components/Notificaciones';
import { trasCerrarModal } from '../../components/capas';
import { AppModal, Boton, CampoSelect, Icono } from '../../components/ui';
import { EstacionDetalle } from './EstacionDetalle';
import { LeafletMap, type LeafletMapHandle } from './LeafletMap';
import type { EventoMapa, MarcadorEstacion } from './mapaHtml';
import type { EstacionOCM } from './types';
import { useNavegacion } from './useNavegacion';
import { CargaRuta } from './CargaRuta';
import { haptica } from '../../utils/haptica';
import { Aparecer, LogoCargando } from '../../components/animacion';
import { infoError } from '../../components/EstadoError';

const CLAVE_CACHE = 'ev-charge:estaciones:nacional';
type InfoEstado = { estado: string; cargadores_reservados?: string[]; cargadores_en_uso?: string[] };
// Cada cuánto se refresca el estado de las estaciones a la vista (cargadores reservados o en uso).
const SEGUNDOS_REFRESCO_ESTADO = 10;
type Limites = { norte: number; sur: number; este: number; oeste: number };

export function MapaScreen() {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const escritorio = width >= BREAKPOINT_ESCRITORIO;
  const { usuario, logout } = useAuth();
  const { abrirAuth } = useUI();
  const params = useLocalSearchParams<{ estacion?: string }>();

  const mapa = useRef<LeafletMapHandle>(null);
  const ajustadoInicial = useRef(false);
  const [estaciones, setEstaciones] = useState<EstacionOCM[]>([]);
  const [cargandoEstaciones, setCargandoEstaciones] = useState(true);
  const [errorEstaciones, setErrorEstaciones] = useState(false);
  const [estados, setEstados] = useState<Record<string, InfoEstado>>({});
  const [limites, setLimites] = useState<Limites | null>(null);
  const [filtro, setFiltro] = useState('TODOS');
  const [filtroDepartamento, setFiltroDepartamento] = useState('TODOS');
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [vehiculoId, setVehiculoId] = useState('');
  const [seleccionada, setSeleccionada] = useState<EstacionOCM | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nav = useNavegacion(mapa);
  const vehiculoActivo = vehiculos.find((v) => v.id === vehiculoId);

  // Carga de estaciones con caché local para mostrar el mapa al instante.
  const cargarEstaciones = useCallback(async () => {
    const mostrar = (data: EstacionOCM[], guardar: boolean) => {
      const validas = data.filter((e) => Number.isFinite(e.AddressInfo?.Latitude) && Number.isFinite(e.AddressInfo?.Longitude));
      setEstaciones(validas);
      if (guardar) AsyncStorage.setItem(CLAVE_CACHE, JSON.stringify(validas)).catch(() => undefined);
    };
    try {
      const cache = await AsyncStorage.getItem(CLAVE_CACHE);
      if (cache) {
        mostrar(JSON.parse(cache) as EstacionOCM[], false);
        setCargandoEstaciones(false);
      }
    } catch {
      // Caché dañada: se ignora.
    }
    setErrorEstaciones(false);
    try {
      mostrar(await listarEstacionesMapa(), true);
    } catch (e) {
      setErrorEstaciones(true);
      const info = infoError(e);
      notificar({ tipo: 'error', titulo: info.titulo, mensaje: info.mensaje });
    } finally {
      setCargandoEstaciones(false);
    }
  }, []);

  useEffect(() => {
    void cargarEstaciones();
  }, [cargarEstaciones]);

  useEffect(() => {
    if (!usuario || usuario.is_admin || usuario.rol === 'empresa') {
      setVehiculos([]);
      setVehiculoId('');
      return;
    }
    listarVehiculos()
      .then((lista) => {
        const activos = lista.filter((v) => v.activo !== false);
        setVehiculos(activos);
        setVehiculoId((actual) => (actual && activos.some((v) => v.id === actual) ? actual : activos[0]?.id || ''));
      })
      .catch(() => setVehiculos([]));
  }, [usuario]);

  const visibles = useMemo(() => estaciones.filter((st) => {
    const conexiones = st.Connections || [];
    if (vehiculoActivo && !conexiones.some((c) => conectorCoincide(c.ConnectionType?.Title || '', vehiculoActivo.tipo_conector))) return false;
    if (filtroDepartamento !== 'TODOS' && departamentoDe(st) !== filtroDepartamento) return false;
    if (filtro !== 'TODOS' && !conexiones.some((c) => (c.ConnectionType?.Title || '').toLowerCase().includes(filtro.toLowerCase()))) return false;
    return true;
  }), [estaciones, filtro, filtroDepartamento, vehiculoActivo]);

  // Estado en vivo de las estaciones dentro del área visible: una sola petición en lote cada 10 s,
  // así quien mira el mapa ve en casi tiempo real cuando otro usuario empieza a cargar.
  const limitesRef = useRef<Limites | null>(null);
  const estadosRef = useRef(estados);
  estadosRef.current = estados;
  const cargarEstadosRef = useRef<(soloNuevos: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    limitesRef.current = limites;
    // Al mover el mapa solo se consultan las estaciones que aún no tienen estado.
    if (limites) void cargarEstadosRef.current(true);
  }, [limites]);

  useEffect(() => {
    if (!visibles.length) return;
    let cancelado = false;
    const cargar = async (soloNuevos = false) => {
      const area = limitesRef.current;
      const enVista = area
        ? visibles.filter((e) => {
            const { Latitude: la, Longitude: lo } = e.AddressInfo!;
            return la <= area.norte && la >= area.sur && lo <= area.este && lo >= area.oeste;
          })
        : visibles;
      const candidatas = soloNuevos ? enVista.filter((e) => !estadosRef.current[String(e.ID)]) : enVista;
      const objetivo = candidatas.slice(0, usuario ? 80 : 40);
      if (!objetivo.length) return;
      let lote: Awaited<ReturnType<typeof obtenerEstadosLote>>;
      try {
        lote = await obtenerEstadosLote(objetivo.map((e) => String(e.ID)));
      } catch {
        return; // Sin conexión se conserva el último estado conocido.
      }
      const resultados = Object.entries(lote).map(([id, estado]) => [id, {
        estado: String(estado.estado || 'disponible'),
        cargadores_reservados: estado.cargadores_reservados,
        cargadores_en_uso: estado.cargadores_en_uso,
      }] as const);
      if (!cancelado) setEstados((actual) => ({ ...actual, ...Object.fromEntries(resultados) }));
    };
    cargarEstadosRef.current = cargar;
    void cargar();
    const intervalo = setInterval(() => void cargar(), SEGUNDOS_REFRESCO_ESTADO * 1000);
    const quitar = escuchar('estaciones-actualizadas', () => void cargar());
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      quitar();
    };
  }, [visibles, usuario]);

  // Estado final del marcador: si todos los cargadores compatibles están ocupados se ve "reservada",
  // o "ocupada" (en uso) si alguno ya está cargando un vehículo.
  const marcadores = useMemo<MarcadorEstacion[]>(() => visibles.map((st) => {
    const id = String(st.ID);
    const info = estados[id] || { estado: 'disponible' };
    const idsCompatibles = (st.Connections || [])
      .map((c, i) => ({ c, id: `${id}-${i + 1}` }))
      .filter(({ c }) => {
        const tipo = c.ConnectionType?.Title || '';
        return (filtro === 'TODOS' || tipo.toLowerCase().includes(filtro.toLowerCase())) && (!vehiculoActivo || conectorCoincide(tipo, vehiculoActivo.tipo_conector));
      })
      .map((x) => x.id);
    const todosReservados = idsCompatibles.length > 0 && idsCompatibles.every((x) => info.cargadores_reservados?.includes(x));
    const algunoEnUso = idsCompatibles.some((x) => info.cargadores_en_uso?.includes(x));
    return {
      id,
      lat: st.AddressInfo!.Latitude,
      lon: st.AddressInfo!.Longitude,
      titulo: nombreEstacion(st),
      estado: info.estado === 'disponible' && todosReservados ? (algunoEnUso ? 'ocupada' : 'reservada') : info.estado,
    };
  }), [visibles, estados, filtro, vehiculoActivo]);

  useEffect(() => {
    if (!marcadores.length) return;
    const ajustar = !ajustadoInicial.current && !params.estacion;
    ajustadoInicial.current = true;
    mapa.current?.enviar({ tipo: 'estaciones', lista: marcadores, ajustar });
  }, [marcadores]);

  useEffect(() => {
    mapa.current?.enviar({ tipo: 'tema', oscuro: colors.modo === 'dark' });
  }, [colors.modo]);

  useEffect(() => {
    mapa.current?.enviar({ tipo: 'seleccionar', id: seleccionada ? String(seleccionada.ID) : null });
  }, [seleccionada]);

  // Enlace directo desde favoritos: /mapa?estacion=ID
  useEffect(() => {
    if (!params.estacion || !estaciones.length) return;
    const estacion = estaciones.find((e) => String(e.ID) === params.estacion);
    if (!estacion?.AddressInfo) return;
    setSeleccionada(estacion);
    mapa.current?.enviar({ tipo: 'vista', lat: estacion.AddressInfo.Latitude, lon: estacion.AddressInfo.Longitude, zoom: 15 });
  }, [params.estacion, estaciones]);

  const alEvento = useCallback((evento: EventoMapa) => {
    if (evento.tipo === 'estacion') {
      haptica.toque();
      setSeleccionada(estaciones.find((e) => String(e.ID) === evento.id) ?? null);
    } else if (evento.tipo === 'limites') {
      setLimites({ norte: evento.norte, sur: evento.sur, este: evento.este, oeste: evento.oeste });
    } else if (evento.tipo === 'error' && evento.mensaje === 'leaflet') {
      notificar({ tipo: 'error', titulo: 'Mapa', mensaje: 'No se pudo cargar el mapa. Revisa tu conexión a internet.' });
    }
  }, [estaciones]);

  const departamentos = useMemo(() => Array.from(new Set(estaciones.map(departamentoDe).filter(Boolean))).sort(), [estaciones]);
  const filtrosActivos = [filtro !== 'TODOS', filtroDepartamento !== 'TODOS', Boolean(vehiculoId)].filter(Boolean).length;

  const cerrarSesion = async () => {
    setMenuAbierto(false);
    nav.detener(true);
    await logout();
    router.replace('/');
  };

  const calcularRuta = (lat: number, lon: number) => {
    if (!escritorio) setSeleccionada(null);
    void nav.calcularRuta(lat, lon);
  };

  const detalle = seleccionada && (
    <EstacionDetalle
      estacion={seleccionada}
      usuario={usuario}
      onLoginRequerido={() => { if (!escritorio) setSeleccionada(null); trasCerrarModal(() => abrirAuth('login')); }}
      onRegistroRequerido={() => { if (!escritorio) setSeleccionada(null); trasCerrarModal(() => abrirAuth('registro')); }}
      onCalcularRuta={calcularRuta}
      filtroConector={filtro}
      tipoConectorVehiculo={vehiculoActivo?.tipo_conector || ''}
      tieneVehiculo={vehiculos.length > 0}
      onRegistrarVehiculo={() => router.push({ pathname: '/dashboard', params: { panel: 'Vehículos' } })}
    />
  );

  const panelNavegacion = nav.infoRuta && !nav.cargandoRuta && (
    <Aparecer key={nav.infoRuta} desde={escritorio ? 'izquierda' : 'abajo'} style={[escritorio ? null : s.navFlotante, !escritorio && { bottom: insets.bottom + 12 }]}>
      <View style={s.navCaja}>
        <Text style={s.navTexto}><Icono name="car" size={13} color={colors.primary} />  {nav.infoRuta}</Text>
        {nav.navegando && <Text style={s.navDetalle}>Navegación activa · {nav.distanciaRestante == null ? 'calculando distancia' : `${nav.distanciaRestante.toFixed(1)} km restantes`}</Text>}
        {nav.instruccion ? <Text style={s.navDetalle}><Icono name="signs-post" size={12} color={colors.textMuted} />  {nav.instruccion}</Text> : null}
        {nav.desvio && <Text style={[s.navDetalle, { color: colors.warning }]}>Te alejaste de la ruta. Recalculando...</Text>}
        <View style={s.navAcciones}>
          <Boton titulo={nav.simulando ? 'Prueba activa' : 'Probar simulación'} pequeno variante="outline" onPress={nav.simular} />
          {nav.navegando && <Boton titulo="Pausar" pequeno variante="outline" onPress={nav.pausar} />}
          {nav.pausada && <Boton titulo="Continuar" pequeno onPress={() => void nav.iniciarNavegacion()} />}
          <Boton titulo="Finalizar" pequeno variante="danger" onPress={() => nav.detener(true)} />
        </View>
      </View>
    </Aparecer>
  );

  const panelBienvenida = (
    <View style={{ gap: 12 }}>
      <View style={s.tarjeta}>
        <Icono name="map" size={22} color={colors.primary} />
        <Text style={s.titulo}>Explora el mapa de EV Charge</Text>
        <Text style={s.texto}>Utiliza el mapa para localizar estaciones de carga, consultar información y encontrar la mejor opción para tu próximo recorrido.</Text>
      </View>
      <View style={s.tarjeta}>
        <Text style={s.subtitulo}>¿Cómo utilizar el mapa?</Text>
        {[['location-dot', 'Explora el mapa'], ['bolt', 'Selecciona una estación'], ['plug', 'Usa los filtros'], ['calendar-days', 'Realiza una reserva'], ['compass', 'Planifica tu recorrido']].map(([icono, texto]) => (
          <View key={texto} style={s.fila}><Icono name={icono} size={13} color={colors.primary} /><Text style={s.texto}>{texto}</Text></View>
        ))}
      </View>
      <Leyenda />
    </View>
  );

  const accionesBarra = (
    <>
      <Pressable onPress={() => setAyudaAbierta(true)} style={s.iconoBoton} accessibilityLabel="Cómo usar EV Charge">
        <Icono name="question" size={14} color={colors.text} />
      </Pressable>
      <Pressable onPress={() => setFiltrosAbiertos(true)} style={[s.iconoBoton, filtrosActivos > 0 && { borderColor: colors.primary }]} accessibilityLabel="Filtros">
        <Icono name="sliders" size={14} color={filtrosActivos ? colors.primary : colors.text} />
        {filtrosActivos > 0 && <View style={s.contador}><Text style={s.contadorTexto}>{filtrosActivos}</Text></View>}
      </Pressable>
      {escritorio && !usuario && (
        <>
          <Boton titulo="Iniciar sesión" pequeno variante="outline" onPress={() => abrirAuth('login')} />
          <Boton titulo="Registrarse" pequeno onPress={() => abrirAuth('registro')} />
        </>
      )}
      <Pressable onPress={() => setMenuAbierto(true)} style={s.iconoBoton} accessibilityLabel="Abrir menú">
        <Icono name={usuario ? 'user' : 'bars'} size={14} color={colors.text} />
      </Pressable>
    </>
  );

  return (
    <View style={s.pantalla}>
      <BarraSuperior derecha={accionesBarra} />
      <View style={[s.cuerpo, escritorio && { flexDirection: 'row' }]}>
        <View style={{ flex: 1 }}>
          <LeafletMap ref={mapa} oscuro={colors.modo === 'dark'} onEvento={alEvento} />
          <CargaRuta etapa={nav.etapaRuta} />
          <View style={s.controles}>
            <Pressable style={s.control} onPress={() => mapa.current?.enviar({ tipo: 'zoom', delta: 1 })} accessibilityLabel="Acercar mapa"><Icono name="plus" size={15} color={colors.text} /></Pressable>
            <Pressable style={s.control} onPress={() => mapa.current?.enviar({ tipo: 'zoom', delta: -1 })} accessibilityLabel="Alejar mapa"><Icono name="minus" size={15} color={colors.text} /></Pressable>
            <Pressable style={s.control} onPress={() => void nav.irAMiUbicacion()} accessibilityLabel="Ir a mi ubicación"><Icono name="location-crosshairs" size={15} color={colors.primary} /></Pressable>
          </View>
          {errorEstaciones && !cargandoEstaciones && !estaciones.length ? (
            // Sin estaciones ni caché: se ofrece reintentar en vez de dejar el mapa vacío.
            <Pressable style={[s.resumen, { borderColor: colors.warning }]} onPress={() => { setCargandoEstaciones(true); void cargarEstaciones(); }} accessibilityRole="button" accessibilityLabel="Reintentar cargar estaciones">
              <Icono name="rotate-right" size={12} color={colors.warning} />
              <Text style={s.resumenTexto}>No cargaron las estaciones · Reintentar</Text>
            </Pressable>
          ) : (
            <View style={s.resumen}>
              {cargandoEstaciones ? <LogoCargando tamano={18} conHalo={false} color={colors.primary} /> : <Icono name="charging-station" size={12} color={colors.primary} />}
              <Text style={s.resumenTexto}>{cargandoEstaciones ? 'Cargando estaciones...' : `${visibles.length} estaciones`}</Text>
            </View>
          )}
          {!escritorio && panelNavegacion}
        </View>

        {escritorio && (
          <View style={s.panelLateral}>
            <ScrollView contentContainerStyle={{ padding: Spacing.md, gap: 12, paddingBottom: 100 }}>
              {panelNavegacion}
              {seleccionada ? (
                <>
                  <Pressable onPress={() => setSeleccionada(null)} style={[s.fila, { alignSelf: 'flex-end' }]} accessibilityLabel="Cerrar detalle">
                    <Text style={s.textoDim}>Cerrar</Text><Icono name="xmark" size={13} color={colors.textDim} />
                  </Pressable>
                  {detalle}
                </>
              ) : panelBienvenida}
            </ScrollView>
          </View>
        )}
      </View>

      {!escritorio && (
        <AppModal visible={!!seleccionada} onClose={() => setSeleccionada(null)} titulo="Información de la estación" anchoMaximo={520}>
          {detalle}
        </AppModal>
      )}

      <AppModal visible={filtrosAbiertos} onClose={() => setFiltrosAbiertos(false)} titulo="Filtrar estaciones">
        <CampoSelect etiqueta="Tipo de conector" valor={filtro} onChange={setFiltro} opciones={[{ valor: 'TODOS', etiqueta: 'Todos los conectores' }, ...TIPOS_CONECTOR.map((t) => ({ valor: t, etiqueta: t }))]} />
        <CampoSelect etiqueta="Departamento" valor={filtroDepartamento} onChange={setFiltroDepartamento} opciones={[{ valor: 'TODOS', etiqueta: 'Todos los departamentos' }, ...departamentos.map((d) => ({ valor: d, etiqueta: d }))]} />
        {usuario && !usuario.is_admin && vehiculos.length > 0 && (
          <CampoSelect etiqueta="Vehículo" valor={vehiculoId} onChange={setVehiculoId} opciones={[{ valor: '', etiqueta: 'Todos los vehículos' }, ...vehiculos.map((v) => ({ valor: v.id, etiqueta: `${v.marca} ${v.modelo} · ${v.tipo_conector}` }))]} />
        )}
        <Text style={s.textoDim}>{visibles.length} estaciones coinciden con los filtros.</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
          {filtrosActivos > 0 && <Boton titulo="Limpiar filtros" variante="outline" onPress={() => { setFiltro('TODOS'); setFiltroDepartamento('TODOS'); setVehiculoId(''); }} style={{ flex: 1 }} />}
          <Boton titulo="Aplicar" onPress={() => setFiltrosAbiertos(false)} style={{ flex: 1 }} />
        </View>
      </AppModal>

      <AppModal visible={ayudaAbierta} onClose={() => setAyudaAbierta(false)} titulo="¿Cómo usar EV Charge?">
        {[['hand-pointer', 'Toca un marcador para ver la estación.'], ['sliders', 'Usa los filtros para buscar por conector, departamento o vehículo.'], ['location-crosshairs', 'Usa el botón de ubicación para centrar el mapa en ti.'], ['route', 'Desde una estación puedes calcular una ruta o reservar.']].map(([icono, texto], i) => (
          <View key={texto} style={[s.fila, { paddingVertical: 6 }]}>
            <View style={s.paso}><Text style={s.pasoTexto}>{i + 1}</Text></View>
            <Icono name={icono} size={14} color={colors.primary} />
            <Text style={[s.texto, { flex: 1 }]}>{texto}</Text>
          </View>
        ))}
        <Leyenda />
        <Text style={s.subtitulo}>Consejos</Text>
        {['Activa tu ubicación para encontrar estaciones cercanas.', 'Revisa el tipo de conector antes de seleccionar una estación.', 'Consulta la disponibilidad antes de realizar una reserva.', 'Usa el zoom para visualizar más estaciones.'].map((t) => (
          <Text key={t} style={s.texto}>•  {t}</Text>
        ))}
      </AppModal>

      <AppModal visible={menuAbierto} onClose={() => setMenuAbierto(false)} titulo="Menú">
        <View style={s.fila}>
          <View style={s.avatar}>{usuario ? <Text style={s.avatarTexto}>{usuario.nombre.charAt(0).toUpperCase()}</Text> : <Icono name="user" size={16} color="#fff" />}</View>
          <View style={{ flex: 1 }}>
            <Text style={s.subtitulo}>{usuario ? nombreCompleto(usuario) : 'Invitado'}</Text>
            <Text style={s.textoDim}>{usuario ? `${usuario.email} · ${usuario.is_admin ? 'Administrador' : usuario.rol === 'empresa' ? 'Empresa' : 'Usuario'}` : 'Inicia sesión para acceder a todas las funciones de EV Charge.'}</Text>
          </View>
        </View>
        <Boton titulo="Inicio" icono="house" variante="outline" onPress={() => { setMenuAbierto(false); router.navigate('/'); }} bloque />
        {!usuario ? (
          <>
            <Boton titulo="Iniciar sesión" icono="key" onPress={() => { setMenuAbierto(false); trasCerrarModal(() => abrirAuth('login')); }} bloque />
            <Boton titulo="Registrarse" icono="user-plus" variante="soft" onPress={() => { setMenuAbierto(false); trasCerrarModal(() => abrirAuth('registro')); }} bloque />
          </>
        ) : (
          <>
            <Boton titulo={usuario.is_admin ? 'Panel admin' : usuario.rol === 'empresa' ? 'Panel de empresa' : 'Mi dashboard'} icono={usuario.is_admin ? 'chart-simple' : usuario.rol === 'empresa' ? 'building' : 'gauge'} variante="soft" onPress={() => { setMenuAbierto(false); router.push(rutaPanel(usuario)); }} bloque />
            <Boton titulo="Cerrar sesión" icono="right-from-bracket" variante="danger" onPress={cerrarSesion} bloque />
          </>
        )}
      </AppModal>
    </View>
  );
}

function Leyenda() {
  const s = useThemedStyles(crearEstilos);
  return (
    <View style={s.tarjeta}>
      <Text style={s.subtitulo}>Estado de las estaciones</Text>
      {[['disponible', 'Disponible'], ['reservada', 'Reservada'], ['ocupada', 'En uso'], ['mantenimiento', 'En mantenimiento'], ['inactiva', 'Fuera de servicio']].map(([clave, texto]) => (
        <View key={clave} style={s.fila}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: coloresEstado[clave] }} />
          <Text style={s.texto}>{texto}</Text>
        </View>
      ))}
    </View>
  );
}

const crearEstilos = (c: Palette) => StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: c.bg },
  cuerpo: { flex: 1 },
  panelLateral: { width: 400, borderLeftWidth: 1, borderLeftColor: c.border, backgroundColor: c.bg },
  controles: { position: 'absolute', right: 12, top: 12, gap: 8 },
  control: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card,
    borderWidth: 1, borderColor: c.border, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  resumen: {
    position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.card,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: c.border, elevation: 4,
  },
  resumenTexto: { color: c.text, fontSize: 12.5, fontWeight: '700' },
  iconoBoton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardElevated, alignItems: 'center', justifyContent: 'center' },
  contador: { position: 'absolute', top: -4, right: -4, backgroundColor: c.primary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { color: '#fff', fontSize: 10, fontWeight: '900' },
  tarjeta: { backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.md, gap: 8 },
  titulo: { color: c.text, fontSize: 18, fontWeight: '900' },
  subtitulo: { color: c.text, fontSize: 14.5, fontWeight: '800' },
  texto: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
  textoDim: { color: c.textDim, fontSize: 12.5 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navCaja: { backgroundColor: c.card, borderRadius: Radius.md, borderWidth: 2, borderColor: c.primary, padding: 12, gap: 6 },
  navFlotante: { position: 'absolute', left: 12, right: 12, elevation: 8, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12 },
  navTexto: { color: c.primary, fontWeight: '800', fontSize: 13.5 },
  navDetalle: { color: c.text, fontSize: 13 },
  navAcciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  paso: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  pasoTexto: { color: c.primary, fontWeight: '900', fontSize: 11 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: '#fff', fontWeight: '900', fontSize: 18 },
});
