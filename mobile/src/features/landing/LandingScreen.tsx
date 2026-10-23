// Pantalla de inicio (landing). Equivale a App.tsx del frontend web:
// hero, categorías, servicios, quiénes somos, cifras, contacto, preguntas frecuentes y pie.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image as RNImage, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { catalogoProductos, infoCategorias } from '../productos/productos.data';
import { pesos } from '../../utils/formato';
import { Presionable } from '../../components/ui/Presionable';
import { Aparecer, Flotar, ProveedorRevelar, Resplandor, Revelar, SeccionRevelar, useReducirMovimiento } from '../../components/animacion';
import { BordeDegradado, Cuadricula, Marquesina, PuntoVivo, TextoDegradado, estiloVidrio } from '../../components/efectos';

type Seccion = 'inicio' | 'categoria' | 'servicios' | 'nosotros' | 'cifras' | 'contacto' | 'faq';

const enlaces: Array<{ id: Seccion; texto: string }> = [
  { id: 'inicio', texto: 'Inicio' },
  { id: 'categoria', texto: 'Categoría' },
  { id: 'servicios', texto: 'Servicios' },
  { id: 'nosotros', texto: 'Quiénes somos' },
  { id: 'cifras', texto: 'En números' },
  { id: 'contacto', texto: 'Contacto' },
];

const servicios = [
  { img: require('../../../assets/images/seccion1.jpg'), titulo: 'Mapa en tiempo real', desc: 'Visualiza todas las estaciones de carga cerca de ti en Bogotá, con información actualizada.', icono: 'map-location-dot' },
  { img: require('../../../assets/images/seccion2.jpg'), titulo: 'Filtro por tu vehículo', desc: 'Registra tu auto y el sistema filtra automáticamente las estaciones compatibles.', icono: 'car-side' },
  { img: require('../../../assets/images/seccion3.jpg'), titulo: 'Planificador de viaje', desc: 'Calcula las paradas de recarga óptimas según tu autonomía usando rutas viales reales.', icono: 'compass' },
  { img: require('../../../assets/images/seccion4.jpg'), titulo: 'Comunidad activa', desc: 'Califica estaciones, reporta cargadores dañados y consulta la experiencia de otros conductores.', icono: 'star' },
  { img: require('../../../assets/images/seccion5.jpg'), titulo: 'Historial de cargas', desc: 'Lleva el registro de cada sesión: kWh cargados, costo estimado y estación utilizada.', icono: 'clipboard-list' },
  { img: require('../../../assets/images/seccion6.jpg'), titulo: 'Reservas inteligentes', desc: 'Programa tus recargas con anticipación, reserva estaciones disponibles y organiza tus viajes de forma eficiente.', icono: 'calendar-check' },
];

const cifras = [
  { valor: '47', etiqueta: 'Estaciones en Bogotá', icono: 'charging-station' },
  { valor: '20', etiqueta: 'km de radio cubierto', icono: 'route' },
  { valor: '5', etiqueta: 'Tipos de conector', icono: 'plug' },
  { valor: '100%', etiqueta: 'Open source', icono: 'code' },
];

const conectores = ['CCS2', 'Tipo 2', 'CHAdeMO', 'GB/T', 'Tesla NACS', 'Carga rápida DC', 'Wallbox residencial', 'Reservas en línea', 'Rutas inteligentes'];

// Productos que se muestran en el inicio (uno por categoría).
const destacados = ['Cargador Rápido DC 150 kW', 'Llanta Michelin Pilot Sport EV 20"', 'Módulo de Batería 48V', 'Cable Tipo 2 a Tipo 2 (5 m)']
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
  const colsCategorias = columnas(260);
  const colsServicios = columnas(330);
  const colsCifras = width < 520 ? 2 : 4;
  const colsDestacados = columnas(250);

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
        onLayout={(e) => { altoVista.current = e.nativeEvent.layout.height; setLimiteVisible((v) => Math.max(v, e.nativeEvent.layout.height)); }}
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
              <Flotar distancia={10} duracion={5200}>
                <View style={s.heroMarco}>
                  <LinearGradient colors={[colors.primaryLight, 'rgba(57,169,0,0.1)', colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
                  <View style={s.heroFoto}>
                    <Image source={catalogoProductos[0].img} style={StyleSheet.absoluteFill} contentFit="cover" transition={500} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
                  </View>
                </View>
              </Flotar>
              <Flotar distancia={7} duracion={4200} style={[s.flotante, { top: escritorio ? 26 : 12, left: escritorio ? -34 : 8 }]}>
                <View style={[s.flotanteCaja, estiloVidrio(colors)]}>
                  <View style={s.flotanteIcono}><Icono name="battery-three-quarters" size={14} color="#fff" /></View>
                  <View>
                    <Text style={s.flotanteTitulo}>80 % en 18 min</Text>
                    <View style={s.flotanteBarra}><LinearGradient colors={[colors.primary, colors.neon]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: '80%', height: '100%', borderRadius: 3 }} /></View>
                  </View>
                </View>
              </Flotar>
              <Flotar distancia={9} duracion={4800} style={[s.flotante, { bottom: escritorio ? 30 : 14, right: escritorio ? -26 : 8 }]}>
                <View style={[s.flotanteCaja, estiloVidrio(colors)]}>
                  <PuntoVivo color={colors.primary} />
                  <View>
                    <Text style={s.flotanteTitulo}>Estación libre</Text>
                    <Text style={s.flotanteSub}>CCS2 · a 1,2 km</Text>
                  </View>
                </View>
              </Flotar>
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

        {/* CATEGORÍAS */}
        <SeccionRevelar onLayout={registrar('categoria')} style={s.seccion}>
          <Encabezado eyebrow="Categorías" titulo="Encuentra lo que necesitas para tu vehículo" sub="Explora nuestras categorías de productos y soluciones para movilidad eléctrica." />
          <View style={s.grid}>
            {infoCategorias.map((c, i) => (
              <Revelar key={c.key} orden={i} style={{ width: anchoTarjeta(colsCategorias) }}>
              <Presionable
                onPress={() => router.push({ pathname: '/productos', params: { categoria: c.key } })}
                style={s.tarjetaCategoria}
                elevarAlPasar
                accessibilityRole="link"
              >
                <Image source={c.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
                <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
                <View style={s.iconoCategoria}><Icono name={c.icono} size={14} color="#fff" /></View>
                <View style={s.categoriaTexto}>
                  <Text style={s.categoriaTitulo}>{c.key}</Text>
                  <Text style={s.categoriaDesc} numberOfLines={2}>{c.descripcion}</Text>
                  <View style={s.filaAccion}>
                    <Text style={[s.accionTexto, { color: colors.neon }]}>Explorar categoría</Text>
                    <Icono name="arrow-right" size={12} color={colors.neon} />
                  </View>
                </View>
              </Presionable>
              </Revelar>
            ))}
          </View>
          <Revelar orden={4}>
            <Boton titulo="Ver todos los productos" variante="soft" icono="bag-shopping" onPress={() => router.push('/productos')} style={{ alignSelf: 'center', marginTop: Spacing.md }} />
          </Revelar>
        </SeccionRevelar>

        {/* PRODUCTOS DESTACADOS */}
        <SeccionRevelar style={[s.seccion, s.seccionAlterna]}>
          <Encabezado eyebrow="Tienda" titulo="Lo más pedido por conductores EV" sub="Equipos con instalación certificada y garantía oficial en Colombia." />
          <View style={s.grid}>
            {destacados.map((p, i) => (
              <Revelar key={p.nombre} orden={i} style={{ width: anchoTarjeta(colsDestacados) }}>
                <Presionable style={s.tarjetaProducto} elevarAlPasar escalaPresion={0.98} onPress={() => router.push({ pathname: '/productos', params: { categoria: p.categoria } })} accessibilityRole="link">
                  <View style={s.productoImgCaja}>
                    <Image source={p.img} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
                    <View style={s.productoEtiqueta}><Text style={s.productoEtiquetaTexto}>{p.etiqueta}</Text></View>
                  </View>
                  <View style={{ padding: Spacing.md, gap: 4 }}>
                    <Text style={s.productoTipo}>{p.tipo}</Text>
                    <Text style={s.tarjetaTitulo} numberOfLines={1}>{p.nombre}</Text>
                    <View style={[s.filaAccion, { justifyContent: 'space-between', marginTop: 4 }]}>
                      <Text style={s.productoPrecio}>{pesos(p.monto)}</Text>
                      <View style={s.productoFlecha}><Icono name="arrow-right" size={12} color="#fff" /></View>
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

        {/* SERVICIOS */}
        <SeccionRevelar onLayout={registrar('servicios')} style={s.seccion}>
          <Encabezado eyebrow="Lo que hacemos" titulo="Todo lo que necesita tu vehículo eléctrico" />
          <View style={s.grid}>
            {servicios.map((sv, i) => (
              <Revelar key={sv.titulo} orden={i % colsServicios} style={{ width: anchoTarjeta(colsServicios) }}>
                <Presionable style={s.tarjetaServicio} elevarAlPasar escalaPresion={0.98}>
                  <View style={s.servicioImgCaja}>
                    <Image source={sv.img} style={s.servicioImg} contentFit="cover" transition={500} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
                    <View style={s.servicioTituloCaja}>
                      <View style={s.servicioIcono}><Icono name={sv.icono} size={15} color="#fff" /></View>
                      <Text style={s.servicioTitulo}>{sv.titulo}</Text>
                    </View>
                  </View>
                  <Text style={[s.tarjetaTexto, { padding: Spacing.md }]}>{sv.desc}</Text>
                </Presionable>
              </Revelar>
            ))}
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
    <Pressable onPress={onPress} style={{ alignSelf: 'center', alignItems: 'center', marginTop: Spacing.xl, gap: 6 }} accessibilityLabel="Desplazarse a categorías">
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
  heroVisual: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  heroMarco: { borderRadius: 30, padding: 2, shadowColor: c.primary, shadowOpacity: 0.45, shadowRadius: 40, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  heroFoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 28, overflow: 'hidden', backgroundColor: '#050806' },
  flotante: { position: 'absolute', zIndex: 2 },
  flotanteCaja: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  flotanteIcono: { width: 30, height: 30, borderRadius: 9, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  flotanteTitulo: { color: c.text, fontSize: 13, fontWeight: '800' },
  flotanteSub: { color: c.textDim, fontSize: 11.5, fontWeight: '600' },
  flotanteBarra: { width: 110, height: 6, borderRadius: 3, backgroundColor: c.border, marginTop: 6, overflow: 'hidden' },
  cinta: { marginTop: Spacing.xxl, marginHorizontal: -Spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.border, paddingVertical: 12, backgroundColor: c.modo === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
  cintaItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22 },
  cintaTexto: { color: c.textMuted, fontSize: 13, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  lineaTitulo: { width: 48, height: 3, borderRadius: 2, backgroundColor: c.primary, marginVertical: 2 },
  iconoCategoria: { position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  servicioImgCaja: { height: 190, overflow: 'hidden' },
  servicioTituloCaja: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  servicioIcono: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  servicioTitulo: { color: '#fff', fontSize: 17, fontWeight: '900', flex: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  seccion: { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.md, width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO + Spacing.md * 2, alignSelf: 'center' },
  seccionAlterna: { maxWidth: undefined, backgroundColor: c.bg2, alignItems: 'center' },
  encabezado: { alignItems: 'center', gap: 8, marginBottom: Spacing.lg, maxWidth: 720, alignSelf: 'center' },
  seccionTitulo: { color: c.text, fontSize: 28, fontWeight: '900', textAlign: 'center', lineHeight: 35, letterSpacing: -0.3 },
  seccionSub: { color: c.textMuted, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO },
  tarjetaCategoria: { height: 300, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: '#050806', justifyContent: 'flex-end', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  categoriaTexto: { padding: Spacing.md, gap: 6 },
  categoriaTitulo: { color: '#fff', fontSize: 20, fontWeight: '900' },
  categoriaDesc: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19 },
  tarjetaTitulo: { color: c.text, fontSize: 16, fontWeight: '800' },
  tarjetaTexto: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accionTexto: { color: c.primary, fontWeight: '800', fontSize: 13 },
  tarjetaProducto: { backgroundColor: c.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  productoImgCaja: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#050806' },
  productoEtiqueta: { position: 'absolute', top: 12, left: 12, backgroundColor: c.primary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  productoEtiquetaTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
  productoTipo: { color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  productoPrecio: { color: c.text, fontSize: 18, fontWeight: '900' },
  productoFlecha: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  tarjetaServicio: { backgroundColor: c.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  servicioImg: { width: '100%', height: '100%' },
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
