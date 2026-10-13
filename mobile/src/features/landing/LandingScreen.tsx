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
import { nombreCompleto, useAuth } from '../../context/AuthContext';
import { useUI } from '../../context/UIContext';
import { useTheme, useThemedStyles } from '../../theme/ThemeContext';
import type { Palette } from '../../theme/colors';
import { ANCHO_MAXIMO_CONTENIDO, BREAKPOINT_ESCRITORIO, Radius, Spacing } from '../../theme/spacing';
import { emailValido } from '../../utils/formato';
import { CampanaNotificaciones, Logo, SelectorTema } from '../../components/Cabecera';
import { notificar } from '../../components/Notificaciones';
import { trasCerrarModal } from '../../components/capas';
import { AppModal, Boton, CampoTexto, Icono } from '../../components/ui';
import { infoCategorias } from '../productos/productos.data';
import { Presionable } from '../../components/ui/Presionable';
import { Aparecer, Flotar, ProveedorRevelar, Resplandor, Respirar, Revelar, SeccionRevelar, useReducirMovimiento } from '../../components/animacion';

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
  { img: require('../../../assets/images/seccion1.png'), titulo: 'Mapa en tiempo real', desc: 'Visualiza todas las estaciones de carga cerca de ti en Bogotá, con información actualizada.', icono: 'map-location-dot' },
  { img: require('../../../assets/images/seccion2.png'), titulo: 'Filtro por tu vehículo', desc: 'Registra tu auto y el sistema filtra automáticamente las estaciones compatibles.', icono: 'car-side' },
  { img: require('../../../assets/images/seccion3.png'), titulo: 'Planificador de viaje', desc: 'Calcula las paradas de recarga óptimas según tu autonomía usando rutas viales reales.', icono: 'compass' },
  { img: require('../../../assets/images/seccion4.png'), titulo: 'Comunidad activa', desc: 'Califica estaciones, reporta cargadores dañados y consulta la experiencia de otros conductores.', icono: 'star' },
  { img: require('../../../assets/images/seccion5.png'), titulo: 'Historial de cargas', desc: 'Lleva el registro de cada sesión: kWh cargados, costo estimado y estación utilizada.', icono: 'clipboard-list' },
  { img: require('../../../assets/images/seccion6.png'), titulo: 'Reservas inteligentes', desc: 'Programa tus recargas con anticipación, reserva estaciones disponibles y organiza tus viajes de forma eficiente.', icono: 'calendar-check' },
];

const cifras = [['47', 'Estaciones en Bogotá'], ['20', 'km de radio cubierto'], ['5', 'Tipos de conector'], ['100%', 'Open source']];

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
  const irA = (id: Seccion) => {
    setMenuAbierto(false);
    scrollRef.current?.scrollTo({ y: Math.max(0, (posiciones.current[id] ?? 0) - 8), animated: true });
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
    if (usuario) router.push(usuario.is_admin ? '/admin' : '/dashboard');
  };

  const year = new Date().getFullYear();
  const colsCategorias = columnas(260);
  const colsServicios = columnas(330);
  const colsCifras = width < 520 ? 2 : 4;

  return (
    <View style={s.pantalla}>
      {/* CABECERA */}
      <View style={[s.nav, { paddingTop: insets.top + 8 }]}>
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
                <Boton titulo={usuario.is_admin ? 'Panel admin' : 'Mi panel'} variante="outline" pequeno onPress={irAlPanel} />
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
        <View onLayout={(e) => registrar('inicio')(e.nativeEvent.layout.y)} style={s.hero}>
          <Resplandor diametro={520} intensidad={1.5} style={{ top: -200, right: -160 }} />
          <Resplandor diametro={440} intensidad={1} style={{ bottom: -160, left: -180 }} />
          <View style={s.heroContenido}>
            <Aparecer desde="escala" duracion={600}>
              <Respirar duracion={4000} escala={0.06}>
                <RNImage source={require('../../../assets/images/logo.png')} style={[s.heroLogo, colors.modo === 'light' && { tintColor: colors.text }]} resizeMode="contain" />
              </Respirar>
            </Aparecer>
            <Aparecer retraso={120}><Text style={s.heroNombre}>EVCHARGE</Text></Aparecer>
            <Aparecer retraso={220}><View style={s.eyebrow}><Text style={s.eyebrowTexto}>Movilidad eléctrica · Colombia</Text></View></Aparecer>
            <Aparecer retraso={340} duracion={650}>
              <Text style={[s.heroTitulo, escritorio && { fontSize: 56, lineHeight: 64 }]}>
                Carga donde{'\n'}<Text style={{ color: colors.primary }}>necesitas,</Text>{'\n'}cuando necesitas.
              </Text>
            </Aparecer>
            <Aparecer retraso={480}>
              <Text style={s.heroSub}>Encuentra estaciones de carga compatibles con tu vehículo, traza rutas inteligentes y conecta con la comunidad EV de Bogotá.</Text>
            </Aparecer>
            <Aparecer retraso={600} style={{ width: '100%', alignItems: 'center' }}>
              <View style={[s.heroAcciones, escritorio && { flexDirection: 'row', width: 'auto' }]}>
                <Boton titulo="Iniciar navegación" icono="bolt" onPress={() => router.push('/mapa')} />
                <Boton titulo="Conoce más" variante="outline" onPress={() => irA('nosotros')} />
              </View>
            </Aparecer>
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
                <View style={s.categoriaImgCaja}>
                  <View style={s.brilloProducto} />
                  <Image source={c.img} style={s.categoriaImg} contentFit="contain" transition={400} />
                  <View style={s.iconoCategoria}><Icono name={c.icono} size={13} color="#fff" /></View>
                </View>
                <Text style={s.tarjetaTitulo}>{c.key}</Text>
                <Text style={s.tarjetaTexto}>{c.descripcion}</Text>
                <View style={s.filaAccion}>
                  <Text style={s.accionTexto}>Explorar categoría</Text>
                  <Icono name="arrow-right" size={12} color={colors.primary} />
                </View>
              </Presionable>
              </Revelar>
            ))}
          </View>
          <Revelar orden={4}>
            <Boton titulo="Ver todos los productos" variante="soft" icono="bag-shopping" onPress={() => router.push('/productos')} style={{ alignSelf: 'center', marginTop: Spacing.md }} />
          </Revelar>
        </SeccionRevelar>

        {/* SERVICIOS */}
        <SeccionRevelar onLayout={registrar('servicios')} style={[s.seccion, s.seccionAlterna]}>
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
                <Image source={require('../../../assets/images/ChatGPT Image 26 jun 2026, 08_44_00 a.m..png')} style={s.nosotrosImg} contentFit="contain" transition={600} />
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
            {cifras.map(([num, etiqueta], i) => (
              <Revelar key={etiqueta} orden={i} desde="escala" style={{ width: anchoTarjeta(colsCifras) }}>
                <View style={s.cifra}>
                  <ContadorAnimado valor={num} activo={limiteVisible > (posiciones.current.cifras ?? Number.POSITIVE_INFINITY) + 120} estilo={s.cifraNum} />
                  <Text style={s.tarjetaTexto}>{etiqueta}</Text>
                </View>
              </Revelar>
            ))}
          </View>
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
          <Boton titulo={usuario.is_admin ? 'Panel de administración' : 'Mi dashboard'} icono="gauge" variante="soft" onPress={irAlPanel} bloque />
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
  nav: { backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 8, paddingHorizontal: Spacing.md, zIndex: 10 },
  navInterior: { width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  navEnlaces: { flexDirection: 'row', gap: 18, flexShrink: 1, flexWrap: 'wrap' },
  navEnlace: { color: c.textMuted, fontWeight: '700', fontSize: 13.5 },
  navAcciones: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saludo: { color: c.textMuted, fontSize: 13, maxWidth: 200 },
  hamburguesa: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cardElevated },
  hero: { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg, overflow: 'hidden', minHeight: 520, justifyContent: 'center' },
  orbeCaja: { position: 'absolute', width: 380, height: 380 },
  orbe: { width: '100%', height: '100%', borderRadius: 190 },
  lineaTitulo: { width: 48, height: 3, borderRadius: 2, backgroundColor: c.primary, marginVertical: 2 },
  brilloProducto: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: c.primary, opacity: c.modo === 'dark' ? 0.16 : 0.12 },
  iconoCategoria: { position: 'absolute', top: 10, left: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  servicioImgCaja: { height: 190, overflow: 'hidden' },
  servicioTituloCaja: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  servicioIcono: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  servicioTitulo: { color: '#fff', fontSize: 17, fontWeight: '900', flex: 1, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  halo: { position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: c.primary, opacity: 0.22 },
  sombraAuto: { width: '55%', height: 14, borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.35)', marginTop: -10 },
  heroContenido: { alignItems: 'center', maxWidth: 760, alignSelf: 'center', width: '100%' },
  heroLogo: { width: 76, height: 76 },
  heroNombre: { color: c.text, fontSize: 20, fontWeight: '900', letterSpacing: 4, marginVertical: 6 },
  eyebrow: { backgroundColor: c.primarySoft, borderWidth: 1, borderColor: c.primaryBorder, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 5, marginBottom: Spacing.md },
  eyebrowTexto: { color: c.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  heroTitulo: { color: c.text, fontSize: 36, lineHeight: 44, fontWeight: '900', textAlign: 'center', marginBottom: Spacing.md },
  heroSub: { color: c.textMuted, fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 560, marginBottom: Spacing.lg },
  heroAcciones: { gap: 12, width: '100%', maxWidth: 420 },
  seccion: { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.md, width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO + Spacing.md * 2, alignSelf: 'center' },
  seccionAlterna: { maxWidth: undefined, backgroundColor: c.bg2, alignItems: 'center' },
  encabezado: { alignItems: 'center', gap: 8, marginBottom: Spacing.lg, maxWidth: 720, alignSelf: 'center' },
  seccionTitulo: { color: c.text, fontSize: 26, fontWeight: '900', textAlign: 'center', lineHeight: 33 },
  seccionSub: { color: c.textMuted, fontSize: 14.5, textAlign: 'center', lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO },
  tarjetaCategoria: { backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.md, gap: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  categoriaImgCaja: { height: 150, borderRadius: Radius.md, backgroundColor: c.cardElevated, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  categoriaImg: { width: '80%', height: '85%' },
  tarjetaTitulo: { color: c.text, fontSize: 16, fontWeight: '800' },
  tarjetaTexto: { color: c.textMuted, fontSize: 13.5, lineHeight: 20 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accionTexto: { color: c.primary, fontWeight: '800', fontSize: 13 },
  tarjetaServicio: { backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  servicioImg: { width: '100%', height: '100%' },
  nosotros: { padding: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: ANCHO_MAXIMO_CONTENIDO, alignSelf: 'center', paddingVertical: Spacing.xxl },
  nosotrosImgCaja: { minHeight: 280, borderRadius: Radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, borderWidth: 1, borderColor: c.primaryBorder },
  bannerTitulo: { position: 'absolute', top: 18, color: c.primary, opacity: 0.18, fontSize: 52, fontWeight: '900', letterSpacing: 4 },
  nosotrosImg: { width: '100%', height: 260 },
  nosotrosTexto: { gap: 10 },
  nosotrosTitulo: { color: c.text, fontSize: 32, fontWeight: '900' },
  parrafo: { color: c.textMuted, fontSize: 15, lineHeight: 23 },
  cifra: { backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.lg, alignItems: 'center', gap: 4 },
  cifraNum: { color: c.primary, fontSize: 38, fontWeight: '900' },
  formContacto: { width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: c.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: c.border, padding: Spacing.lg },
  faqLista: { width: '100%', maxWidth: 760, gap: 10 },
  faqItem: { backgroundColor: c.card, borderRadius: Radius.md, borderWidth: 1, borderColor: c.border, overflow: 'hidden' },
  faqPregunta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: Spacing.md },
  faqPreguntaTexto: { color: c.text, fontSize: 15, fontWeight: '700', flex: 1 },
  faqRespuesta: { color: c.textMuted, fontSize: 14, lineHeight: 21, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  pie: { borderTopWidth: 1, borderTopColor: c.border, paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, backgroundColor: c.bg },
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
