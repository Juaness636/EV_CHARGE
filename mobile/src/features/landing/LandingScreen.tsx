// Pantalla de inicio (landing). Equivale a App.tsx del frontend web:
// hero, categorías, servicios, quiénes somos, cifras, contacto, preguntas frecuentes y pie.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { enviarContacto } from '../../api/contacto.api';
import { mensajeError } from '../../api/httpClient';
import { nombreCompleto, rutaPanel, useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { ANCHO_MAXIMO_CONTENIDO, BREAKPOINT_ESCRITORIO, Radius, Spacing } from '../../theme/spacing';
import { emailValido } from '../../utils/formato';
import { CampanaNotificaciones, Logo, SelectorTema } from '../../components/Cabecera';
import { notificar } from '../../components/Notificaciones';
import { trasCerrarModal } from '../../components/capas';
import { AppModal, Boton, CampoTexto, Icono } from '../../components/ui';
import { catalogoProductos } from '../productos/productos.data';
import { Escenario } from '../productos/Escenario';
import { pesos } from '../../utils/formato';
import { Presionable } from '../../components/ui/Presionable';
import { Aparecer, Flotar, ProveedorRevelar, Resplandor, Revelar, SeccionRevelar, useReducirMovimiento } from '../../components/animacion';
import { BordeDegradado, Cuadricula, Marquesina, PuntoVivo, TextoDegradado, estiloVidrio } from '../../components/efectos';

type Seccion = 'inicio' | 'categoria' | 'servicios' | 'nosotros' | 'cifras' | 'contacto' | 'faq';

const enlaces: Array<{ id: Seccion; texto: string }> = [
  { id: 'inicio', texto: 'Inicio' },
  { id: 'categoria', texto: 'Tienda' },
  { id: 'servicios', texto: 'Servicios' },
  { id: 'nosotros', texto: 'Quiénes somos' },
  { id: 'cifras', texto: 'En números' },
  { id: 'contacto', texto: 'Contacto' },
];

const servicios: Array<{ img: number; titulo: string; desc: string; icono: string; dato: string; ruta: '/mapa' | '/dashboard' }> = [
  { img: require('../../../assets/images/seccion1.jpg'), titulo: 'Mapa en tiempo real', desc: 'Visualiza todas las estaciones de carga cerca de ti en Bogotá, con disponibilidad, conectores y precios actualizados.', icono: 'map-location-dot', dato: '47 estaciones', ruta: '/mapa' },
  { img: require('../../../assets/images/seccion6.jpg'), titulo: 'Reservas inteligentes', desc: 'Reserva tu cargador con anticipación y llega sin filas.', icono: 'calendar-check', dato: 'Pago verificado', ruta: '/mapa' },
  { img: require('../../../assets/images/seccion2.jpg'), titulo: 'Filtro por tu vehículo', desc: 'Registra tu auto y verás solo las estaciones compatibles.', icono: 'car-side', dato: '5 conectores', ruta: '/dashboard' },
  { img: require('../../../assets/images/seccion3.jpg'), titulo: 'Planificador de viaje', desc: 'Paradas de recarga óptimas según tu autonomía, con rutas viales reales.', icono: 'compass', dato: 'Rutas reales', ruta: '/mapa' },
  { img: require('../../../assets/images/seccion4.jpg'), titulo: 'Comunidad activa', desc: 'Califica estaciones y reporta cargadores dañados.', icono: 'star', dato: 'Reseñas reales', ruta: '/mapa' },
  { img: require('../../../assets/images/seccion5.jpg'), titulo: 'Historial de cargas', desc: 'Cada sesión registrada: kWh cargados, costo y estación utilizada.', icono: 'clipboard-list', dato: 'kWh y costos', ruta: '/dashboard' },
];

const cifras = [
  { valor: '47', etiqueta: 'Estaciones en Bogotá', icono: 'charging-station' },
  { valor: '20', etiqueta: 'km de radio cubierto', icono: 'route' },
  { valor: '5', etiqueta: 'Tipos de conector', icono: 'plug' },
  { valor: '100%', etiqueta: 'Open source', icono: 'code' },
];

// Diapositivas del hero: cambian cada pocos segundos con un fundido y sus propios datos flotantes.
// Fotos del inicio: escenas reales de carga que van rotando, cada una con sus propios chips.
const diapositivasHero = [
  { titulo: 'Estación de carga rápida', img: require('../../../assets/images/hero/estacion-rapida.jpg'), icono: 'bolt', dato: '80 % en 18 min', barra: 0.8, estado: 'Estación libre', sub: 'CCS2 · 150 kW' },
  { titulo: 'Reserva desde la app', img: require('../../../assets/images/hero/app-mapa.jpg'), icono: 'map-location-dot', dato: 'Reserva en 3 pasos', barra: 0.66, estado: 'Turno confirmado', sub: 'Mapa en tiempo real' },
  { titulo: 'Carga en casa con wallbox', img: require('../../../assets/images/hero/garaje-wallbox.jpg'), icono: 'house', dato: 'Carga en casa', barra: 0.9, estado: 'Programada', sub: 'Horas valle · 22 kW' },
  { titulo: 'Cargador portátil de viaje', img: require('../../../assets/images/hero/viaje-portatil.jpg'), icono: 'suitcase', dato: 'Carga donde estés', barra: 0.55, estado: 'Listo para viajar', sub: 'Toma doméstica · 7,4 kW' },
];
const INTERVALO_HERO = 5000;

const conectores = ['CCS2', 'Tipo 2', 'CHAdeMO', 'GB/T', 'Tesla NACS', 'Carga rápida DC', 'Wallbox residencial', 'Reservas en línea', 'Rutas inteligentes'];

// Productos que se muestran en el inicio (uno por categoría).
const destacados = ['Cargador Portátil 7,4 kW', 'Llanta Michelin Pilot Sport EV 20"', 'Módulo de Batería 48V', 'Adaptador CCS2 a GB/T']
  .map((n) => catalogoProductos.find((p) => p.nombre === n))
  .filter((p): p is (typeof catalogoProductos)[number] => !!p);

const preguntasFrecuentes = [
  { pregunta: '¿Qué es EV Charge?', respuesta: 'Es una plataforma para encontrar estaciones de carga, revisar sus cargadores y organizar la recarga de tu vehículo eléctrico.' },
  { pregunta: '¿Cómo encuentro un cargador compatible?', respuesta: 'Registra tu vehículo y usa el filtro correspondiente. El mapa resaltará los cargadores que coinciden con el tipo de conector de tu vehículo.' },
  { pregunta: '¿Cómo hago una reserva?', respuesta: 'Abre el mapa, selecciona una estación y el cargador compatible. Después elige la fecha, la hora y la duración de la recarga.' },
  { pregunta: '¿Puedo ver el precio antes de reservar?', respuesta: 'Sí. En la información del cargador puedes cambiar la duración y consultar el valor estimado antes de confirmar.' },
  { pregunta: '¿Qué significan los colores de las estaciones?', respuesta: 'Verde significa que hay disponibilidad, rojo indica mantenimiento o fuera de servicio y azul indica que todos los cargadores están reservados.' },
  { pregunta: '¿Qué hago si encuentro un problema?', respuesta: 'Puedes reportarlo desde la información de la estación. También puedes calificarla y revisar los reportes de otros usuarios.' },
];

export function LandingScreen() {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const escritorio = width >= BREAKPOINT_ESCRITORIO;
  const navCompleta = width >= 1280;
  const { usuario, logout } = useAuth();
  const { abrirAuth } = useUI();

  const scrollRef = useRef<ScrollView>(null);
  const posiciones = useRef<Partial<Record<Seccion, number>>>({});
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [faqAbierta, setFaqAbierta] = useState<number | null>(null);
  const [contacto, setContacto] = useState({ nombre: '', apellido: '', correo: '', mensaje: '' });
  const [enviandoContacto, setEnviandoContacto] = useState(false);
  const [contactoEnviado, setContactoEnviado] = useState(false);

  const registrar = (id: Seccion) => (y: number) => {
    posiciones.current[id] = y;
  };
  // Borde inferior visible del scroll: activa el revelado de cada sección.
  const [limiteVisible, setLimiteVisible] = useState(0);
  const altoVista = useRef(0);
  // La barra superior flota sobre el contenido (vidrio esmerilado); su alto desplaza el hero.
  const [altoNav, setAltoNav] = useState(64);
  const irA = (id: Seccion) => {
    setMenuAbierto(false);
    const y = posiciones.current[id] ?? 0;
    scrollRef.current?.scrollTo({ y: id === 'inicio' ? 0 : Math.max(0, y - altoNav - 8), animated: true });
  };

  const columnas = (min: number) => Math.max(1, Math.min(4, Math.floor(Math.min(width, ANCHO_MAXIMO_CONTENIDO) / min)));
  const anchoTarjeta = (cols: number) => (cols === 1 ? '100%' : `${100 / cols - 2}%`) as `${number}%`;

  const enviarFormularioContacto = async () => {
    const { nombre, apellido, correo, mensaje } = contacto;
    if (!nombre.trim() || !apellido.trim() || !correo.trim() || !mensaje.trim()) {
      return notificar({ tipo: 'warning', titulo: 'Contacto', mensaje: 'Completa todos los campos del formulario.' });
    }
    if (!emailValido(correo)) return notificar({ tipo: 'warning', titulo: 'Contacto', mensaje: 'Ingresa un correo válido.' });
    setEnviandoContacto(true);
    try {
      await enviarContacto({ nombre: nombre.trim(), apellido: apellido.trim(), correo: correo.trim(), mensaje: mensaje.trim() });
      setContacto({ nombre: '', apellido: '', correo: '', mensaje: '' });
      setContactoEnviado(true);
      setTimeout(() => setContactoEnviado(false), 5000);
    } catch (e) {
      notificar({ tipo: 'error', titulo: 'Contacto', mensaje: mensajeError(e, 'No se pudo enviar el mensaje.') });
    } finally {
      setEnviandoContacto(false);
    }
  };

  const cerrarSesion = async () => {
    setMenuAbierto(false);
    await logout();
    notificar({ tipo: 'success', titulo: 'Sesión cerrada', mensaje: 'Hasta pronto.' });
  };

  const irAlPanel = () => {
    setMenuAbierto(false);
    if (usuario) router.push(rutaPanel(usuario));
  };

  const year = new Date().getFullYear();
  const colsCifras = width < 520 ? 2 : 4;
  const colsDestacados = width < 520 ? 2 : columnas(250);
  const compacto = width < 520;

  return (
    <View style={s.pantalla}>
      {/* CABECERA */}
      <View style={[s.nav, estiloVidrio(colors), { paddingTop: insets.top + 8 }]} onLayout={(e) => setAltoNav(e.nativeEvent.layout.height)}>
        <View style={s.navInterior}>
          <Logo onPress={() => irA('inicio')} mostrarNombre={width >= 380} />
          {navCompleta && (
            <View style={s.navEnlaces}>
              {enlaces.map((e) => (
                <Pressable key={e.id} onPress={() => irA(e.id)} hitSlop={6}>
                  <Text style={s.navEnlace}>{e.texto}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={s.navAcciones}>
            {usuario && <CampanaNotificaciones />}
            {escritorio && (usuario ? (
              <>
                <Text style={s.saludo} numberOfLines={1}>Hola, <Text style={{ color: colors.primary, fontWeight: '800' }}>{nombreCompleto(usuario)}</Text></Text>
                <Boton titulo={usuario.is_admin ? 'Panel admin' : usuario.rol === 'empresa' ? 'Mi empresa' : 'Mi panel'} variante="outline" pequeno onPress={irAlPanel} />
                <Boton titulo="Salir" variante="danger" pequeno onPress={cerrarSesion} />
              </>
            ) : (
              <>
                <Boton titulo="Iniciar sesión" variante="outline" pequeno onPress={() => abrirAuth('login')} />
                <Boton titulo="Registrarse" variante="outline" pequeno onPress={() => abrirAuth('registro')} />
              </>
            ))}
            {escritorio && <Boton titulo="Abrir mapa" icono="location-dot" iconoDerecha pequeno onPress={() => router.push('/mapa')} />}
            {!navCompleta && (
              <Pressable onPress={() => setMenuAbierto(true)} style={s.hamburguesa} accessibilityRole="button" accessibilityLabel="Abrir menú">
                <Icono name="bars" size={18} color={colors.text} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        scrollEventThrottle={48}
        onLayout={(e) => {
          // Leer la altura antes del setState: en Android el evento se libera y nativeEvent queda en null.
          const alto = e.nativeEvent.layout.height;
          altoVista.current = alto;
          setLimiteVisible((v) => Math.max(v, alto));
        }}
        onScroll={(e) => {
          const limite = e.nativeEvent.contentOffset.y + altoVista.current;
          setLimiteVisible((v) => (limite > v + 40 ? limite : v));
        }}
      >
        <ProveedorRevelar limiteVisible={limiteVisible}>
        {/* HERO */}
        <View onLayout={(e) => registrar('inicio')(e.nativeEvent.layout.y)} style={[s.hero, { paddingTop: altoNav + (escritorio ? Spacing.xxl : Spacing.lg) }]}>
          <LinearGradient
            colors={colors.modo === 'dark' ? ['#0c1f0a', colors.bg, colors.bg] : ['#d8efcb', colors.bg, colors.bg]}
            locations={[0, 0.55, 1]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Cuadricula />
          <Resplandor diametro={escritorio ? 720 : 460} intensidad={1.6} style={{ top: -220, right: escritorio ? -120 : -200 }} />
          <Resplandor diametro={420} intensidad={0.9} style={{ bottom: -140, left: -200 }} />
          <View style={[s.heroInterior, escritorio && { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxl }]}>
            <View style={[s.heroTexto, escritorio && { flex: 1, alignItems: 'flex-start' }]}>
              <Aparecer retraso={80}>
                <View style={[s.eyebrow, estiloVidrio(colors, 10)]}>
                  <PuntoVivo color={colors.primary} tamano={7} />
                  <Text style={s.eyebrowTexto}>47 estaciones activas · Bogotá</Text>
                </View>
              </Aparecer>
              <Aparecer retraso={200} duracion={700}>
                <Text style={[s.heroTitulo, escritorio ? s.heroTituloPc : null]}>
                  Carga donde{'\n'}<TextoDegradado style={[s.heroTitulo, escritorio ? s.heroTituloPc : null]}>necesitas,</TextoDegradado>{'\n'}cuando necesitas.
                </Text>
              </Aparecer>
              <Aparecer retraso={340}>
                <Text style={[s.heroSub, escritorio && { textAlign: 'left' }]}>Encuentra estaciones compatibles con tu vehículo, reserva tu turno y traza rutas con paradas de carga. Todo en un solo lugar.</Text>
              </Aparecer>
              <Aparecer retraso={460} style={{ width: '100%', alignItems: escritorio ? 'flex-start' : 'center' }}>
                <View style={[s.heroAcciones, (escritorio || width >= 480) && { flexDirection: 'row', width: 'auto' }]}>
                  <Boton titulo="Iniciar navegación" icono="bolt" onPress={() => router.push('/mapa')} />
                  <Boton titulo="Ver tienda" icono="bag-shopping" variante="outline" onPress={() => router.push('/productos')} />
                </View>
              </Aparecer>
              <Aparecer retraso={580}>
                <View style={[s.heroDatos, escritorio && { justifyContent: 'flex-start' }]}>
                  {[['150 kW', 'potencia máxima'], ['5', 'conectores'], ['24/7', 'disponibilidad']].map(([v, t], i) => (
                    <View key={t} style={[s.heroDato, i > 0 && s.heroDatoSeparado]}>
                      <Text style={s.heroDatoValor}>{v}</Text>
                      <Text style={s.heroDatoTexto}>{t}</Text>
                    </View>
                  ))}
                </View>
              </Aparecer>
            </View>
            <Aparecer desde="escala" retraso={300} duracion={800} style={[s.heroVisual, escritorio && { flex: 1 }]}>
              <HeroCarrusel escritorio={escritorio} />
            </Aparecer>
          </View>
          <View style={s.cinta}>
            <Marquesina
              elementos={conectores}
              renderItem={(t) => (
                <View style={s.cintaItem}>
                  <Icono name="bolt" size={11} color={colors.primary} />
                  <Text style={s.cintaTexto}>{t}</Text>
                </View>
              )}
            />
          </View>
          <IndicadorScroll onPress={() => irA('categoria')} />
        </View>

        {/* PRODUCTOS DESTACADOS */}
        <SeccionRevelar onLayout={registrar('categoria')} style={[s.seccion, s.seccionAlterna]}>
          <Encabezado eyebrow="Tienda" titulo="Lo más pedido por conductores EV" sub="Equipos con instalación certificada y garantía oficial en Colombia." />
          <View style={s.grid}>
            {destacados.map((p, i) => (
              <Revelar key={p.nombre} orden={i} style={{ width: anchoTarjeta(colsDestacados) }}>
                <Presionable style={s.tarjetaProducto} elevarAlPasar escalaPresion={0.98} onPress={() => router.push({ pathname: '/productos', params: { categoria: p.categoria } })} accessibilityRole="link">
                  <View>
                    <Escenario producto={p} indice={i} />
                    <View style={s.productoEtiqueta}><Text style={s.productoEtiquetaTexto}>{p.etiqueta}</Text></View>
                  </View>
                  <View style={{ padding: compacto ? Spacing.sm + 4 : Spacing.md, gap: 4 }}>
                    <Text style={s.productoTipo} numberOfLines={1}>{p.tipo}</Text>
                    <Text style={[s.tarjetaTitulo, compacto && { fontSize: 14 }]} numberOfLines={compacto ? 2 : 1}>{p.nombre}</Text>
                    <View style={[s.filaAccion, { justifyContent: 'space-between', marginTop: 4 }]}>
                      <Text style={[s.productoPrecio, compacto && { fontSize: 15 }]}>{pesos(p.monto)}</Text>
                      {!compacto && <View style={s.productoFlecha}><Icono name="arrow-right" size={12} color="#fff" /></View>}
                    </View>
                  </View>
                </Presionable>
              </Revelar>
            ))}
          </View>
          <Revelar orden={4}>
            <Boton titulo="Ir a la tienda" icono="bag-shopping" iconoDerecha onPress={() => router.push('/productos')} style={{ alignSelf: 'center', marginTop: Spacing.lg }} />
          </Revelar>
        </SeccionRevelar>

        {/* SERVICIOS: mosaico (bento) con la primera tarjeta destacada */}
        <SeccionRevelar onLayout={registrar('servicios')} style={s.seccion}>
          <Revelar>
            <View style={[s.serviciosCabecera, escritorio && { flexDirection: 'row', alignItems: 'flex-end' }]}>
              <View style={[{ gap: 8 }, escritorio && { flex: 1.3 }]}>
                <Text style={s.eyebrowTexto}>Lo que hacemos</Text>
                <Text style={[s.seccionTitulo, { textAlign: escritorio ? 'left' : 'center' }, escritorio && { fontSize: 38, lineHeight: 44 }]}>
                  Todo lo que necesita{'\n'}tu <TextoDegradado style={[s.seccionTitulo, escritorio && { fontSize: 38, lineHeight: 44 }]}>vehículo eléctrico</TextoDegradado>
                </Text>
              </View>
              <View style={[{ gap: 12 }, escritorio ? { flex: 1, alignItems: 'flex-start' } : { alignItems: 'center' }]}>
                <Text style={[s.seccionSub, escritorio && { textAlign: 'left' }]}>Seis herramientas conectadas entre sí: encuentra, reserva, planifica y lleva el control de cada carga desde un solo lugar.</Text>
                <Boton titulo="Probar el mapa" icono="arrow-right" iconoDerecha variante="soft" pequeno onPress={() => router.push('/mapa')} />
              </View>
            </View>
          </Revelar>
          <View style={s.bento}>
            {servicios.map((sv, i) => {
              // PC: fila 1 = destacada (2/3) + 1; fila 2 = tres tarjetas; fila 3 = banda horizontal.
              const ancho = !escritorio ? '100%' : i === 0 ? '65.6%' : i === 5 ? '100%' : '32.2%';
              const alto = !escritorio ? 280 : i === 0 || i === 1 ? 420 : i === 5 ? 240 : 320;
              return (
                <Revelar key={sv.titulo} orden={i} desde={i === 0 ? 'escala' : 'abajo'} style={{ width: ancho }}>
                  <TarjetaServicio servicio={sv} indice={i} alto={alto} destacada={i === 0} banda={escritorio && i === 5} onPress={() => router.push(sv.ruta)} />
                </Revelar>
              );
            })}
          </View>
        </SeccionRevelar>

        {/* QUIÉNES SOMOS */}
        <SeccionRevelar onLayout={registrar('nosotros')} style={[s.nosotros, escritorio && { flexDirection: 'row', alignItems: 'center' }]}>
          <Revelar desde="escala" style={escritorio ? { flex: 1 } : undefined}>
            <View style={s.nosotrosImgCaja}>
              <LinearGradient colors={colors.modo === 'dark' ? ['#0f2a07', '#0a140a', '#050805'] : ['#d9f2cc', '#e9f5e3', '#f5faf2']} style={StyleSheet.absoluteFill} />
              <Text style={s.bannerTitulo}>EV CHARGE</Text>
              <Resplandor diametro={340} intensidad={1.4} />
              <Flotar distancia={10} style={{ width: '100%' }}>
                <Image source={require('../../../assets/images/nosotros-auto.png')} style={s.nosotrosImg} contentFit="contain" transition={600} />
              </Flotar>
            </View>
          </Revelar>
          <View style={[s.nosotrosTexto, escritorio && { flex: 1 }]}>
            <Revelar orden={1} desde="izquierda"><Text style={s.eyebrowTexto}>Quiénes somos</Text></Revelar>
            <Revelar orden={2} desde="izquierda"><Text style={s.nosotrosTitulo}>EV Charge</Text></Revelar>
            <Revelar orden={3} desde="izquierda"><Text style={s.parrafo}>Proyecto desarrollado por aprendices ADSO del SENA.</Text></Revelar>
            <Revelar orden={4} desde="izquierda"><Text style={s.parrafo}>Impulsamos la movilidad eléctrica mediante una plataforma inteligente para localizar estaciones de carga, administrar vehículos, gestionar reservas y ofrecer una mejor experiencia a los conductores de vehículos eléctricos.</Text></Revelar>
            <Revelar orden={5} desde="izquierda"><Boton titulo="Conoce más" onPress={() => irA('contacto')} style={{ alignSelf: 'flex-start', marginTop: 8 }} /></Revelar>
          </View>
        </SeccionRevelar>

        {/* CIFRAS */}
        <SeccionRevelar onLayout={registrar('cifras')} style={[s.seccion, s.seccionAlterna]}>
          <Encabezado eyebrow="En números" titulo="La red eléctrica que ya existe" />
          <View style={s.grid}>
            {cifras.map((cf, i) => (
              <Revelar key={cf.etiqueta} orden={i} desde="escala" style={{ width: anchoTarjeta(colsCifras) }}>
                <BordeDegradado radio={Radius.lg} interior={s.cifra}>
                  <View style={s.cifraIcono}><Icono name={cf.icono} size={16} color={colors.primary} /></View>
                  <ContadorAnimado valor={cf.valor} activo={limiteVisible > (posiciones.current.cifras ?? Number.POSITIVE_INFINITY) + 120} estilo={s.cifraNum} />
                  <Text style={[s.tarjetaTexto, { textAlign: 'center' }]}>{cf.etiqueta}</Text>
                </BordeDegradado>
              </Revelar>
            ))}
          </View>
        </SeccionRevelar>

        {/* LLAMADO A LA ACCIÓN */}
        <SeccionRevelar style={s.seccion}>
          <Revelar desde="escala">
            <View style={[s.cta, escritorio && { flexDirection: 'row', alignItems: 'center', padding: Spacing.xxl }]}>
              <LinearGradient colors={colors.modo === 'dark' ? ['#123d06', '#0a1a07', '#050a05'] : ['#cdebbd', '#e4f3dc', '#f7fbf4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Cuadricula paso={32} style={{ opacity: 0.8 }} />
              <Resplandor diametro={480} intensidad={1.6} style={{ right: -120, top: -180 }} />
              <View style={[{ gap: 10 }, escritorio && { flex: 1 }]}>
                <Text style={s.ctaEyebrow}>Empieza hoy</Text>
                <Text style={[s.ctaTitulo, escritorio && { fontSize: 36, lineHeight: 42 }]}>Tu próxima carga está{'\n'}a un toque.</Text>
                <Text style={s.ctaSub}>Crea tu cuenta gratis, registra tu vehículo y reserva en la estación compatible más cercana.</Text>
              </View>
              <View style={[{ gap: 10, marginTop: Spacing.md }, escritorio && { marginTop: 0, minWidth: 240 }]}>
                <Boton titulo="Abrir el mapa" icono="location-dot" onPress={() => router.push('/mapa')} bloque />
                {!usuario && <Boton titulo="Crear cuenta gratis" variante="outline" onPress={() => abrirAuth('registro')} bloque />}
              </View>
            </View>
          </Revelar>
        </SeccionRevelar>

        {/* CONTACTO */}
        <SeccionRevelar onLayout={registrar('contacto')} style={s.seccion}>
          <Encabezado eyebrow="Contacto" titulo="¿Tienes una estación de carga que quieras registrar?" sub="Escríbenos y la agregamos al mapa." />
          <Revelar orden={1} style={{ width: '100%', alignItems: 'center' }}>
          <View style={s.formContacto}>
            <View style={{ flexDirection: width >= 600 ? 'row' : 'column', gap: width >= 600 ? 12 : 0 }}>
              <View style={{ flex: 1 }}><CampoTexto etiqueta="Nombre" requerido value={contacto.nombre} onChangeText={(v) => setContacto({ ...contacto, nombre: v })} placeholder="Tu nombre" /></View>
              <View style={{ flex: 1 }}><CampoTexto etiqueta="Apellido" requerido value={contacto.apellido} onChangeText={(v) => setContacto({ ...contacto, apellido: v })} placeholder="Tu apellido" /></View>
            </View>
            <CampoTexto etiqueta="Correo" requerido value={contacto.correo} onChangeText={(v) => setContacto({ ...contacto, correo: v })} placeholder="correo@ejemplo.com" keyboardType="email-address" autoCapitalize="none" />
            <CampoTexto etiqueta="Mensaje" requerido value={contacto.mensaje} onChangeText={(v) => setContacto({ ...contacto, mensaje: v })} placeholder="Cuéntanos sobre la estación o tu consulta..." multiline numberOfLines={4} />
            <Boton titulo="Enviar mensaje" icono="paper-plane" iconoDerecha cargando={enviandoContacto} onPress={enviarFormularioContacto} bloque />
            {contactoEnviado && <Aparecer><Text style={{ color: colors.primary, marginTop: 10, fontWeight: '700' }}>¡Mensaje enviado! Te contactaremos pronto.</Text></Aparecer>}
          </View>
          </Revelar>
        </SeccionRevelar>

        {/* PREGUNTAS FRECUENTES */}
        <SeccionRevelar onLayout={registrar('faq')} style={[s.seccion, s.seccionAlterna]}>
          <Encabezado eyebrow="Ayuda rápida" titulo="Preguntas frecuentes" sub="Resuelve tus dudas sobre el mapa, las reservas y tu vehículo eléctrico." />
          <View style={s.faqLista}>
            {preguntasFrecuentes.map((item, i) => {
              const abierta = faqAbierta === i;
              return (
                <Revelar key={item.pregunta} orden={i}>
                <View style={[s.faqItem, abierta && { borderColor: colors.primaryBorder }]}>
                  <Pressable onPress={() => setFaqAbierta(abierta ? null : i)} style={s.faqPregunta} accessibilityRole="button" accessibilityState={{ expanded: abierta }}>
                    <Text style={s.faqPreguntaTexto}>{item.pregunta}</Text>
                    <Icono name={abierta ? 'minus' : 'plus'} size={13} color={colors.primary} />
                  </Pressable>
                  {abierta && <Aparecer duracion={300}><Text style={s.faqRespuesta}>{item.respuesta}</Text></Aparecer>}
                </View>
                </Revelar>
              );
            })}
          </View>
        </SeccionRevelar>

        {/* PIE DE PÁGINA */}
        <View style={s.pie}>
          <View style={[s.pieInterior, escritorio && { flexDirection: 'row' }]}>
            <View style={[s.pieColumna, escritorio && { flex: 1.4 }]}>
              <Logo />
              <Text style={s.tarjetaTexto}>Plataforma para localizar y gestionar estaciones de carga para vehículos eléctricos en Colombia.</Text>
            </View>
            <View style={s.pieColumna}>
              <Text style={s.pieTitulo}>Navegación</Text>
              {enlaces.map((e) => <Pressable key={e.id} onPress={() => irA(e.id)}><Text style={s.pieEnlace}>{e.texto}</Text></Pressable>)}
              <Pressable onPress={() => router.push('/productos')}><Text style={s.pieEnlace}>Productos</Text></Pressable>
              <Pressable onPress={() => irA('faq')}><Text style={s.pieEnlace}>Preguntas frecuentes</Text></Pressable>
            </View>
            <View style={s.pieColumna}>
              <Text style={s.pieTitulo}>Contacto</Text>
              <Text style={s.pieEnlace}><Icono name="envelope" size={12} color={colors.textDim} />  eevcharge@gmail.com</Text>
              <Text style={s.pieEnlace}><Icono name="location-dot" size={12} color={colors.textDim} />  Bogotá D.C., Colombia</Text>
              <Text style={s.pieEnlace}><Icono name="phone" size={12} color={colors.textDim} />  +57 300 123 4567</Text>
            </View>
            <View style={s.pieColumna}>
              <Text style={s.pieTitulo}>Información</Text>
              <Text style={s.pieEnlace}>Versión 2.0</Text>
              <Text style={s.pieEnlace}>Proyecto académico SENA ADSO</Text>
              <Text style={s.pieEnlace}>Última actualización: {year}</Text>
              <View style={{ marginTop: 8, alignSelf: 'flex-start' }}><SelectorTema /></View>
            </View>
          </View>
          <Text style={s.pieCopy}>© {year} EV Charge · Todos los derechos reservados.</Text>
        </View>
        </ProveedorRevelar>
      </ScrollView>

      {/* MENÚ MÓVIL */}
      <AppModal visible={menuAbierto} onClose={() => setMenuAbierto(false)} titulo="Menú">
        {usuario ? (
          <View style={s.menuUsuario}>
            <View style={s.avatar}><Text style={s.avatarTexto}>{usuario.nombre.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.tarjetaTitulo}>{nombreCompleto(usuario)}</Text>
              <Text style={s.tarjetaTexto}>{usuario.email}</Text>
            </View>
          </View>
        ) : null}
        <Boton titulo="Abrir mapa" icono="location-dot" onPress={() => { setMenuAbierto(false); router.push('/mapa'); }} bloque />
        {usuario ? (
          <Boton titulo={usuario.is_admin ? 'Panel de administración' : usuario.rol === 'empresa' ? 'Panel de empresa' : 'Mi dashboard'} icono="gauge" variante="soft" onPress={irAlPanel} bloque />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Boton titulo="Iniciar sesión" variante="outline" onPress={() => { setMenuAbierto(false); trasCerrarModal(() => abrirAuth('login')); }} style={{ flex: 1 }} />
            <Boton titulo="Registrarse" variante="soft" onPress={() => { setMenuAbierto(false); trasCerrarModal(() => abrirAuth('registro')); }} style={{ flex: 1 }} />
          </View>
        )}
        <View style={s.menuSeparador} />
        {enlaces.map((e) => (
          <Pressable key={e.id} onPress={() => irA(e.id)} style={s.menuEnlace}>
            <Text style={s.menuEnlaceTexto}>{e.texto}</Text>
            <Icono name="chevron-right" size={12} color={colors.textDim} />
          </Pressable>
        ))}
        <Pressable onPress={() => { setMenuAbierto(false); router.push('/productos'); }} style={s.menuEnlace}>
          <Text style={s.menuEnlaceTexto}>Productos</Text>
          <Icono name="chevron-right" size={12} color={colors.textDim} />
        </Pressable>
        <View style={s.menuSeparador} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={s.tarjetaTexto}>Tema</Text>
          <SelectorTema />
        </View>
        {usuario && <Boton titulo="Cerrar sesión" icono="right-from-bracket" variante="danger" onPress={cerrarSesion} bloque style={{ marginTop: 8 }} />}
      </AppModal>
    </View>
  );
}

// Carrusel del hero: fundido entre fotos con un zoom lento (efecto Ken Burns) y chips que cambian.
// Con "reducir movimiento" no avanza solo; los puntos permiten cambiar a mano.
function HeroCarrusel({ escritorio }: { escritorio: boolean }) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const reducir = useReducirMovimiento();
  const [actual, setActual] = useState(0);
  const [pausa, setPausa] = useState(false);
  const opacidades = useRef(diapositivasHero.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const chips = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducir || pausa) return;
    const id = setInterval(() => setActual((a) => (a + 1) % diapositivasHero.length), INTERVALO_HERO);
    return () => clearInterval(id);
  }, [reducir, pausa]);

  useEffect(() => {
    const nativo = Platform.OS !== 'web';
    Animated.parallel(opacidades.map((v, i) => Animated.timing(v, { toValue: i === actual ? 1 : 0, duration: reducir ? 0 : 900, easing: Easing.inOut(Easing.quad), useNativeDriver: nativo }))).start();
    chips.setValue(0);
    Animated.timing(chips, { toValue: 1, duration: reducir ? 0 : 600, delay: reducir ? 0 : 250, easing: Easing.out(Easing.cubic), useNativeDriver: nativo }).start();
    if (!reducir) {
      zoom.setValue(0);
      Animated.timing(zoom, { toValue: 1, duration: INTERVALO_HERO + 900, easing: Easing.linear, useNativeDriver: nativo }).start();
    }
  }, [actual, reducir, opacidades, chips, zoom]);

  const d = diapositivasHero[actual];
  const entradaChip = { opacity: chips, transform: [{ translateY: chips.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };
  return (
    <Pressable onHoverIn={() => setPausa(true)} onHoverOut={() => setPausa(false)} accessibilityLabel={`Imagen ${actual + 1} de ${diapositivasHero.length}: ${d.titulo}`}>
      <Flotar distancia={10} duracion={5200}>
        <View style={s.heroMarco}>
          <LinearGradient colors={[colors.primaryLight, 'rgba(57,169,0,0.1)', colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
          <View style={s.heroFoto}>
            {diapositivasHero.map((dia, i) => (
              <Animated.View
                key={dia.titulo}
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { opacity: opacidades[i], transform: [{ scale: i === actual ? zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) : 1.08 }] }]}
              >
                <Image source={dia.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
              </Animated.View>
            ))}
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={s.heroPuntos}>
              {diapositivasHero.map((dia, i) => (
                <Pressable key={dia.titulo} onPress={() => setActual(i)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Ver ${dia.titulo}`}>
                  <View style={[s.heroPunto, i === actual && s.heroPuntoActivo]} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Flotar>
      <Flotar distancia={7} duracion={4200} style={[s.flotante, { top: escritorio ? 26 : 12, left: escritorio ? -34 : 8 }]}>
        <Animated.View style={[s.flotanteCaja, estiloVidrio(colors), entradaChip]}>
          <View style={s.flotanteIcono}><Icono name={d.icono} size={14} color="#fff" /></View>
          <View>
            <Text style={s.flotanteTitulo}>{d.dato}</Text>
            <View style={s.flotanteBarra}><LinearGradient colors={[colors.primary, colors.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${d.barra * 100}%`, height: '100%', borderRadius: 3 }} /></View>
          </View>
        </Animated.View>
      </Flotar>
      <Flotar distancia={9} duracion={4800} style={[s.flotante, { bottom: escritorio ? 30 : 34, right: escritorio ? -26 : 8 }]}>
        <Animated.View style={[s.flotanteCaja, estiloVidrio(colors), entradaChip]}>
          <PuntoVivo color={colors.primary} />
          <View>
            <Text style={s.flotanteTitulo}>{d.estado}</Text>
            <Text style={s.flotanteSub}>{d.sub}</Text>
          </View>
        </Animated.View>
      </Flotar>
    </Pressable>
  );
}

// Tarjeta de servicio con foto a sangre, zoom al pasar el mouse y borde verde que se enciende.
function TarjetaServicio({ servicio, indice, alto, destacada, banda, onPress }: {
  servicio: (typeof servicios)[number]; indice: number; alto: number; destacada: boolean; banda: boolean; onPress: () => void;
}) {
  const s = useThemedStyles(crearEstilos);
  const { colors } = useTheme();
  const reducir = useReducirMovimiento();
  const [activo, setActivo] = useState(false);
  const zoom = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducir) return;
    Animated.timing(zoom, { toValue: activo ? 1 : 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [activo, reducir, zoom]);
  return (
    <Presionable
      onPress={onPress}
      onHoverIn={() => setActivo(true)}
      onHoverOut={() => setActivo(false)}
      elevarAlPasar
      escalaPresion={0.98}
      accessibilityRole="link"
      accessibilityLabel={servicio.titulo}
      style={[s.servicio, { height: alto }, activo && { borderColor: colors.primaryBorder }]}
    >
      <Animated.View style={[banda ? s.servicioFotoBanda : StyleSheet.absoluteFill, { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>
        {/* Las fotos traen un rótulo abajo: se ancla arriba y el degradado lo cubre. */}
        <Image source={servicio.img} style={[StyleSheet.absoluteFill, !banda && { bottom: '-14%' }]} contentFit="cover" contentPosition="top" transition={500} />
      </Animated.View>
      <LinearGradient
        colors={banda ? ['rgba(5,8,6,0)', 'rgba(5,8,6,0.9)', '#050806'] : ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.05)', 'rgba(3,6,4,0.95)', '#030604']}
        locations={banda ? [0.2, 0.5, 0.62] : [0, 0.25, 0.6, 0.8]}
        start={banda ? { x: 0, y: 0 } : { x: 0, y: 0 }}
        end={banda ? { x: 1, y: 0 } : { x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={[s.servicioNumero, destacada && { fontSize: 96 }]}>{String(indice + 1).padStart(2, '0')}</Text>
      <View style={[s.servicioChip, estiloVidrio(colors, 10), { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <Icono name={servicio.icono} size={12} color={colors.neon} />
        <Text style={s.servicioChipTexto}>{servicio.dato}</Text>
      </View>
      <View style={[s.servicioCuerpo, banda && { left: '52%', top: 0, justifyContent: 'center' }]}>
        <Text style={[s.servicioTitulo, destacada && { fontSize: 30, lineHeight: 36 }]}>{servicio.titulo}</Text>
        <Text style={[s.servicioDesc, destacada && { fontSize: 15.5, maxWidth: 460 }]}>{servicio.desc}</Text>
        <View style={s.filaAccion}>
          <Text style={[s.accionTexto, { color: colors.neon }]}>{servicio.ruta === '/mapa' ? 'Abrir el mapa' : 'Ir a mi panel'}</Text>
          <Animated.View style={{ transform: [{ translateX: zoom.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }] }}>
            <Icono name="arrow-right" size={12} color={colors.neon} />
          </Animated.View>
        </View>
      </View>
    </Presionable>
  );
}

function Encabezado({ eyebrow, titulo, sub }: { eyebrow: string; titulo: string; sub?: string }) {
  const s = useThemedStyles(crearEstilos);
  return (
    <Revelar style={s.encabezado}>
      <Text style={s.eyebrowTexto}>{eyebrow}</Text>
      <Text style={s.seccionTitulo}>{titulo}</Text>
      <View style={s.lineaTitulo} />
      {sub && <Text style={s.seccionSub}>{sub}</Text>}
    </Revelar>
  );
}

// Cuenta desde 0 hasta el valor cuando la sección de cifras entra en pantalla ("47", "100%").
function ContadorAnimado({ valor, activo, estilo }: { valor: string; activo: boolean; estilo: object }) {
  const reducir = useReducirMovimiento();
  const numero = Number.parseInt(valor, 10);
  const sufijo = valor.replace(/^\d+/, '');
  const [actual, setActual] = useState(reducir ? numero : 0);
  const progreso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!activo || reducir || Number.isNaN(numero)) return;
    const id = progreso.addListener(({ value }) => setActual(Math.round(value * numero)));
    Animated.timing(progreso, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => progreso.removeListener(id);
  }, [activo, reducir, numero, progreso]);
  if (Number.isNaN(numero)) return <Text style={estilo}>{valor}</Text>;
  return <Text style={estilo}>{reducir ? numero : actual}{sufijo}</Text>;
}

// Flecha que invita a desplazarse, igual que "Desplázate" del web.
function IndicadorScroll({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const reducir = useReducirMovimiento();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducir) return;
    const bucle = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    bucle.start();
    return () => bucle.stop();
  }, [reducir, v]);
  return (
    <Pressable onPress={onPress} style={{ alignSelf: 'center', alignItems: 'center', marginTop: Spacing.xl, gap: 6 }} accessibilityLabel="Desplazarse a la tienda">
      <Text style={{ color: colors.textDim, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Desplázate</Text>
      <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }] }}>
        <Icono name="chevron-down" size={16} color={colors.primary} />
      </Animated.View>
    </Pressable>
  );
}

const crearEstilos = (c: Palette) => StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: c.bg },
  nav: { position: 'absolute', top: 0, left: 0, right: 0, borderBottomWidth: 1, paddingBottom: 8, paddingHorizontal: Spacing.md, zIndex: 20, elevation: 8 },
  navInterior: { width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  navEnlaces: { flexDirection: 'row', gap: 18, flexShrink: 1, flexWrap: 'wrap' },
  navEnlace: { color: c.textMuted, fontWeight: '700', fontSize: 13.5 },
  navAcciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saludo: { color: c.textMuted, fontSize: 13, maxWidth: 200 },
  hamburguesa: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardElevated },
  hero: { paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md, overflow: 'hidden', justifyContent: 'center' },
  heroInterior: { width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center', gap: Spacing.xl },
  heroTexto: { alignItems: 'center' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: Radius.full, paddingLeft: 8, paddingRight: 14, paddingVertical: 4, marginBottom: Spacing.md },
  eyebrowTexto: { color: c.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  heroTitulo: { color: c.text, fontSize: 40, lineHeight: 46, fontWeight: '900', textAlign: 'center', marginBottom: Spacing.md, letterSpacing: -0.5 },
  heroTituloPc: { fontSize: 58, lineHeight: 64, textAlign: 'left', letterSpacing: -1.5 },
  heroSub: { color: c.textMuted, fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 560, marginBottom: Spacing.lg },
  heroAcciones: { gap: 12, width: '100%', maxWidth: 420 },
  heroDatos: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  heroDato: { paddingHorizontal: Spacing.md, alignItems: 'flex-start' },
  heroDatoSeparado: { borderLeftWidth: 1, borderLeftColor: c.borderStrong },
  heroDatoValor: { color: c.text, fontSize: 22, fontWeight: '900' },
  heroDatoTexto: { color: c.textDim, fontSize: 12, fontWeight: '600' },
  heroVisual: { width: '100%', maxWidth: 540, alignSelf: 'center' },
  heroMarco: { borderRadius: 30, padding: 2, shadowColor: c.primary, shadowOpacity: 0.45, shadowRadius: 40, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  heroFoto: { width: '100%', aspectRatio: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: '#050806' },
  flotante: { position: 'absolute', zIndex: 2 },
  heroPuntos: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  heroPunto: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  heroPuntoActivo: { width: 24, backgroundColor: '#39ff14' },
  flotanteCaja: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  flotanteIcono: { width: 30, height: 30, borderRadius: 9, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  flotanteTitulo: { color: c.text, fontSize: 13, fontWeight: '800' },
  flotanteSub: { color: c.textDim, fontSize: 11.5, fontWeight: '600' },
  flotanteBarra: { width: 110, height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 6, overflow: 'hidden' },
  cinta: { marginTop: Spacing.xxl, marginHorizontal: -Spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, paddingVertical: 12, backgroundColor: c.modo === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
  cintaItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22 },
  cintaTexto: { color: c.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  lineaTitulo: { width: 48, height: 3, borderRadius: 2, backgroundColor: c.primary, marginVertical: 2 },
  seccion: { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.md, width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO + Spacing.md * 2, alignSelf: 'center' },
  seccionAlterna: { maxWidth: undefined, backgroundColor: c.bg2, alignItems: 'center' },
  encabezado: { alignItems: 'center', gap: 8, marginBottom: Spacing.lg, maxWidth: 720, alignSelf: 'center' },
  seccionTitulo: { color: c.text, fontSize: 28, fontWeight: '900', textAlign: 'center', lineHeight: 35, letterSpacing: -0.3 },
  seccionSub: { color: c.textMuted, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO },
  tarjetaTitulo: { color: c.text, fontSize: 16, fontWeight: '800' },
  tarjetaTexto: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accionTexto: { color: c.primary, fontWeight: '800', fontSize: 13 },
  tarjetaProducto: { backgroundColor: c.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  bordeAcento: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  productoEtiqueta: { position: 'absolute', zIndex: 3, top: 12, left: 12, backgroundColor: c.primary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  productoEtiquetaTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
  productoTipo: { color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  productoPrecio: { color: c.text, fontSize: 18, fontWeight: '900' },
  productoFlecha: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  serviciosCabecera: { gap: Spacing.md, marginBottom: Spacing.xl, alignItems: 'center', width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center' },
  bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center' },
  servicio: { borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: '#050806', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  servicioFotoBanda: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '60%' },
  servicioNumero: { position: 'absolute', top: 6, right: 16, fontSize: 64, fontWeight: '900', color: 'rgba(255,255,255,0.14)', letterSpacing: -2 },
  servicioChip: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 11, paddingVertical: 6 },
  servicioChipTexto: { color: '#fff', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },
  servicioCuerpo: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: Spacing.lg, gap: 8 },
  servicioTitulo: { color: '#fff', fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.3 },
  servicioDesc: { color: 'rgba(255,255,255,0.78)', fontSize: 13.5, lineHeight: 20 },
  nosotros: { padding: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center', paddingVertical: Spacing.xxl },
  nosotrosImgCaja: { minHeight: 280, borderRadius: Radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, borderWidth: 1, borderColor: c.primaryBorder },
  bannerTitulo: { position: 'absolute', top: 18, color: c.primary, opacity: 0.18, fontSize: 52, fontWeight: '900', letterSpacing: 4 },
  nosotrosImg: { width: '100%', height: 260 },
  nosotrosTexto: { gap: 10 },
  nosotrosTitulo: { color: c.text, fontSize: 32, fontWeight: '900' },
  parrafo: { color: c.textMuted, fontSize: 15, lineHeight: 23 },
  cifra: { padding: Spacing.lg, alignItems: 'center', gap: 6 },
  cifraIcono: { width: 40, height: 40, borderRadius: 12, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  cifraNum: { color: c.primary, fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  cta: { borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, borderWidth: 1, borderColor: c.primaryBorder, gap: Spacing.lg },
  ctaEyebrow: { color: c.modo === 'dark' ? c.neon : c.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  ctaTitulo: { color: c.text, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.5 },
  ctaSub: { color: c.textMuted, fontSize: 15, lineHeight: 22, maxWidth: 520 },
  formContacto: { width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: c.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border, padding: Spacing.lg },
  faqLista: { width: '100%', maxWidth: 760, gap: 10 },
  faqItem: { backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  faqPregunta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: Spacing.md },
  faqPreguntaTexto: { color: c.text, fontSize: 15, fontWeight: '700', flex: 1 },
  faqRespuesta: { color: c.textMuted, fontSize: 14, lineHeight: 21, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  pie: { borderTopWidth: 1, borderTopColor: c.border, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, backgroundColor: c.bg2 },
  pieInterior: { width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center', gap: Spacing.lg },
  pieColumna: { flex: 1, gap: 8 },
  pieTitulo: { color: c.text, fontWeight: '800', fontSize: 14, marginBottom: 2 },
  pieEnlace: { color: c.textMuted, fontSize: 13 },
  pieCopy: { color: c.textDim, fontSize: 12, textAlign: 'center', marginTop: Spacing.xl },
  menuUsuario: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: '#fff', fontWeight: '900', fontSize: 18 },
  menuSeparador: { height: 1, backgroundColor: c.border, marginVertical: 8 },
  menuEnlace: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  menuEnlaceTexto: { color: c.text, fontSize: 15, fontWeight: '700' },
});
