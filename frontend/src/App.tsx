import { FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './styles.css';
import { login, registro, obtenerPerfil, logout as logoutApi, ApiError, type Usuario } from './api/auth.api';
import { OlvidarContrasena } from './components/OlvidarContrasena';

type AuthTab = 'login' | 'registro' | 'recuperar';
type AlertType = 'error' | 'success';
type ThemeMode = 'dark' | 'light' | 'system';

type Notificacion = {
  id: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  tipo: 'compra' | 'reserva' | 'vehiculo' | 'sistema';
};

// ==========================================
// DATOS DE LOS PRODUCTOS POR CATEGORÍA
// ==========================================
type CategoriaKey = 'Cargadores' | 'Llantas' | 'Baterías' | 'Cables y conectores';

const productosPorCategoria: Record<CategoriaKey, Array<{nombre: string, desc: string, precio: string, img: string}>> = {
  'Cargadores': [
    { nombre: 'Cargador Rápido DC 150 kW', desc: 'Ideal para estaciones comerciales de carga ultra rápida.', precio: 'Consultar precio', img: '/img/cargador-rapido-150kw.png' },
    { nombre: 'Wallbox Inteligente 22 kW', desc: 'La solución compacta perfecta para tu casa o garaje.', precio: '$3.500.000 COP', img: '/img/wallbox-22kw.png' },
    { nombre: 'Cargador Portátil 7.4 kW', desc: 'Llévalo contigo en el baúl a todas partes.', precio: '$1.200.000 COP', img: '/img/cargador-portatil-74kw.png' }
  ],
  'Llantas': [
    { nombre: 'Llanta Michelin Pilot Sport EV 20"', desc: 'Alto rendimiento, bajo ruido y diseñada para el torque eléctrico.', precio: '$1.250.000 COP', img: 'dist/img/llanta.png' },
    { nombre: 'Llanta Hankook iON evo 22"', desc: 'Optimiza la autonomía de la batería con menor resistencia a la rodadura.', precio: '$1.480.000 COP', img: 'dist/img/llanta.png' }
  ],
  'Baterías': [
    { nombre: 'Módulo de Batería 48V', desc: 'Repuesto original de celdas de iones de litio de alta densidad.', precio: '$2.800.000 COP', img: 'dist/img/Baterias.png' },
    { nombre: 'Batería Auxiliar 12V EV', desc: 'Soporte para los sistemas electrónicos y pantalla del vehículo.', precio: '$450.000 COP', img: 'dist/img/Baterias.png' }
  ],
  'Cables y conectores': [
    { nombre: 'Cable Tipo 2 a Tipo 2 (5m)', desc: 'Soporta carga trifásica de hasta 22kW.', precio: '$480.000 COP', img: 'dist/img/Cables_y_Conectores.png' },
    { nombre: 'Adaptador CCS2 a GB/T', desc: 'Compatibilidad total con el estándar de carga chino.', precio: '$750.000 COP', img: 'dist/img/Cables_y_Conectores.png' }
  ]
};

function App() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [alert, setAlert] = useState<{ message: string; type: AlertType } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<Usuario | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [regNombre, setRegNombre] = useState('');
  const [regApellido, setRegApellido] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConfirm, setRegPassConfirm] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [year] = useState(() => new Date().getFullYear());
  
  // ESTADO PARA NOTIFICACIONES
  const [notifOpen, setNotifOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([
    {
      id: '1',
      titulo: '¡Vehículo registrado!',
      mensaje: 'Has añadido tu nuevo vehículo a tu garaje exitosamente.',
      fecha: 'Hace 5 min',
      leida: false,
      tipo: 'vehiculo'
    },
    {
      id: '2',
      titulo: 'Reserva confirmada',
      mensaje: 'Tu estación de carga en Calle 100 fue reservada para hoy a las 3:00 PM.',
      fecha: 'Hace 2 horas',
      leida: false,
      tipo: 'reserva'
    },
    {
      id: '3',
      titulo: 'Compra completada',
      mensaje: 'Recibo generado para: Cargador Wallbox 22 kW.',
      fecha: 'Ayer',
      leida: true,
      tipo: 'compra'
    }
  ]);

  const unreadCount = notificaciones.filter(n => !n.leida).length;

  const marcarComoLeidas = () => {
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })));
  };

  // ESTADO PARA ABRIR/CERRAR EL MODAL DE CATEGORÍAS
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<CategoriaKey | null>(null);

  // Estado para controlar el error del sistema por imagen en el centro
  const [errorSistema, setErrorSistema] = useState<{ visible: boolean; mensaje: string }>({
    visible: false,
    mensaje: '',
  });

  // ==========================================
  // ESTADO Y LÓGICA DE TEMA (CLARO/OSCURO/SISTEMA)
  // ==========================================
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => (localStorage.getItem('ev_theme') as ThemeMode) || 'system'
  );

  useEffect(() => {
    const root = document.documentElement;

    const aplicarTema = (mode: ThemeMode) => {
      let temaEfectivo = mode;
      if (mode === 'system') {
        temaEfectivo = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.setAttribute('data-theme', temaEfectivo);
      localStorage.setItem('ev_theme', mode);
    };

    aplicarTema(themeMode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (themeMode === 'system') aplicarTema('system');
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themeMode]);

  const requirements = useMemo(() => ({
    min: regPass.length >= 8,
    may: /[A-Z]/.test(regPass),
    low: /[a-z]/.test(regPass),
    num: /\d/.test(regPass),
    sim: /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(regPass),
    same: regPass === regPassConfirm && regPass !== '',
  }), [regPass, regPassConfirm]);

  const score = Object.values(requirements).filter(Boolean).length;
  const passwordComplete = score === 6;
  const passwordPercent = (score / 6) * 100;

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.section'));
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav-link'));
    const navbar = document.getElementById('navbar');

    const observerNav = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((link) => link.classList.remove('active'));
          document.querySelector(`.nav-link[href="#${entry.target.id}"]`)?.classList.add('active');
        }
      });
    }, { threshold: 0.4 });

    sections.forEach((section) => observerNav.observe(section));

    const observerReveal = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observerReveal.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach((element) => observerReveal.observe(element));

    const onScroll = () => navbar?.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll);

    return () => {
      observerNav.disconnect();
      observerReveal.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('ev_token');
    if (!token) return;

    obtenerPerfil()
      .then((data) => setCurrentUser(data.usuario))
      .catch(() => {
        localStorage.removeItem('ev_token');
        setCurrentUser(null);
      });
  }, []);

  useEffect(() => {
    document.body.style.overflow = (authModalOpen || categoriaSeleccionada || errorSistema.visible) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [authModalOpen, categoriaSeleccionada, errorSistema.visible]);

  const openAuthModal = (tab: AuthTab) => {
    setAuthTab(tab);
    setAlert(null);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAlert(null);
  };

  const switchAuthTab = (tab: AuthTab) => {
    setAuthTab(tab);
    setAlert(null);
  };

  const smoothTo = (id: string, event?: MouseEvent<HTMLAnchorElement | HTMLDivElement | HTMLButtonElement>) => {
    event?.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenuOpen(false);
  };

  const enviarContacto = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactSent(true);
    event.currentTarget.reset();
    window.setTimeout(() => setContactSent(false), 5000);
  };

  const doLogin = async (event?: FormEvent) => {
    event?.preventDefault();
    const email = loginEmail.trim();
    const pass = loginPass;
    if (!email || !pass) {
      setAlert({ message: '⚠️ Completa todos los campos', type: 'error' });
      return;
    }

    setAuthLoading(true);
    setAlert(null);
    try {
      const data = await login(email, pass);
      closeAuthModal();
      window.location.href = data.usuario.is_admin ? '/admin' : '/mapa';
    } catch (error: any) {
      // Captura 401, 400 y 422 para mostrar alerta sin cerrar el modal
      if (error instanceof ApiError && (error.status === 401 || error.status === 400 || error.status === 422)) {
        setAlert({ message: '⚠️ Correo o contraseña incorrectos', type: 'error' });
      } else {
        closeAuthModal();
        setErrorSistema({ visible: true, mensaje: '' });
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const doRegistro = async (event?: FormEvent) => {
    event?.preventDefault();
    const nombre = regNombre.trim();
    const apellido = regApellido.trim();
    const email = regEmail.trim();
    const pass = regPass;

    if (!nombre || !email || !pass) {
      setAlert({ message: '⚠️ Completa todos los campos', type: 'error' });
      return;
    }
    if (!passwordComplete) {
      setAlert({ message: '⚠️ Tu contraseña no cumple todos los requisitos', type: 'error' });
      return;
    }

    setAuthLoading(true);
    setAlert(null);
    try {
      await registro(nombre, apellido, email, pass);

      setAlert({ message: '✅ ¡Registro exitoso! Ahora inicia sesión.', type: 'success' });
      setRegNombre('');
      setRegApellido('');
      setRegEmail('');
      setRegPass('');
      setRegPassConfirm('');
      setAuthTab('login');
      setLoginEmail(email);
      window.setTimeout(() => document.getElementById('login-pass')?.focus(), 0);
    } catch (error: any) {
      closeAuthModal();
      setErrorSistema({ visible: true, mensaje: '' });
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    logoutApi();
    setCurrentUser(null);
    window.location.reload();
  };

  const requirementsList = [
    ['min', 'Mínimo 8 caracteres'],
    ['may', 'Una mayúscula'],
    ['low', 'Una minúscula'],
    ['num', 'Un número'],
    ['sim', 'Un símbolo'],
    ['same', 'Las contraseñas coinciden'],
  ] as const;

  return (
    <>
      <nav id="navbar">
        <div className="nav-inner">
          <a className="nav-logo" href="#inicio">
            <img src="/img/logo.png" alt="EV Charge" />
          </a>
          <ul className={`nav-links${mobileMenuOpen ? ' open' : ''}`}>
            <li><a href="#inicio" className="nav-link active" onClick={() => setMobileMenuOpen(false)}>Inicio</a></li>
            <li><a href="#categoria" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Categoría</a></li>
            <li><a href="#servicios" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Servicios</a></li>
            <li><a href="#Productos" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Productos</a></li>
            <li><a href="#nosotros" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Quiénes somos</a></li>
            <li><a href="#cifras" className="nav-link" onClick={() => setMobileMenuOpen(false)}>En números</a></li>
            <li><a href="#contacto" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Contacto</a></li>
          </ul>

          {!currentUser ? (
            <div className="auth-actions" id="auth-actions">
              <button className="btn-nav-outline" onClick={() => openAuthModal('login')}>Iniciar sesión</button>
              <button className="btn-nav-outline" onClick={() => openAuthModal('registro')}>Registrarse</button>
            </div>
          ) : (
            <div className="user-greeting" id="user-greeting">
              {/* CENTRO DE NOTIFICACIONES */}
              <div className="notif-wrapper">
                <button 
                  className="notif-btn" 
                  onClick={() => {
                    setNotifOpen(!notifOpen);
                    if (!notifOpen && unreadCount > 0) marcarComoLeidas();
                  }}
                  title="Notificaciones"
                >
                  <i className="fa-solid fa-bell"></i>
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>

                {notifOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <h4>Notificaciones</h4>
                      <span className="notif-count">{notificaciones.length} en total</span>
                    </div>

                    <div className="notif-list">
                      {notificaciones.length === 0 ? (
                        <p className="notif-empty">No tienes notificaciones por el momento.</p>
                      ) : (
                        notificaciones.map((n) => (
                          <div key={n.id} className={`notif-item ${!n.leida ? 'unread' : ''}`}>
                            <div className="notif-icon">
                              {n.tipo === 'vehiculo' && <i className="fa-solid fa-car"></i>}
                              {n.tipo === 'reserva' && <i className="fa-solid fa-calendar-check"></i>}
                              {n.tipo === 'compra' && <i className="fa-solid fa-bag-shopping"></i>}
                              {n.tipo === 'sistema' && <i className="fa-solid fa-bolt"></i>}
                            </div>
                            <div className="notif-content">
                              <div className="notif-title-row">
                                <h5>{n.titulo}</h5>
                                <span className="notif-time">{n.fecha}</span>
                              </div>
                              <p>{n.mensaje}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <span>Bienvenido, <span className="username" id="welcome-username">{currentUser.apellido ? `${currentUser.nombre} ${currentUser.apellido}` : currentUser.nombre}</span></span>
              <button className="btn-nav-outline-logout" onClick={logout}>Salir</button>
            </div>
          )}

          <Link className="btn-nav" to="/mapa">Abrir mapa <i className="fa-solid fa-location-dot"></i></Link>
          <button className="hamburger" id="hamburger" aria-label="Menú" onClick={() => setMobileMenuOpen((value) => !value)}>
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      {/* WIDGET FLOTANTE DE TEMA */}
      <div className="theme-floating-widget">
        <button className={`theme-btn ${themeMode === 'dark' ? 'active' : ''}`} onClick={() => setThemeMode('dark')} title="Modo Oscuro">
          <i className="fa-solid fa-moon"></i>
        </button>
        <button className={`theme-btn ${themeMode === 'light' ? 'active' : ''}`} onClick={() => setThemeMode('light')} title="Modo Claro">
          <i className="fa-solid fa-sun"></i>
        </button>
        <button className={`theme-btn ${themeMode === 'system' ? 'active' : ''}`} onClick={() => setThemeMode('system')} title="Tema del Sistema">
          <i className="fa-solid fa-desktop"></i>
        </button>
      </div>

      <section id="inicio" className="section hero-section">
        <div className="glow-orb orb1"></div>
        <div className="glow-orb orb2"></div>
        <div className="hero-content">
          <img src="/img/logo.png" alt="EV Charge" className="hero-logo" />
          <p className="hero-eyebrow">Movilidad eléctrica · Colombia</p>
          <h1 className="hero-title">Carga donde<br /><span className="accent">necesitas,</span><br />cuando necesitas.</h1>
          <p className="hero-sub">Encuentra estaciones de carga compatibles con tu vehículo, traza rutas inteligentes y conecta con la comunidad EV de Bogotá.</p>
          <div className="hero-actions">
            <Link to="/mapa" className="btn-primary-lg"><span className="btn-icon"><i className="fa-solid fa-bolt"></i></span> Iniciar navegación</Link>
            <a href="#nosotros" className="btn-ghost-lg" onClick={(e) => smoothTo('nosotros', e)}>Conoce más</a>
          </div>
        </div>
        <div className="hero-scroll-hint" onClick={(e) => smoothTo('nosotros', e)}>
          <span>Desplázate</span><div className="scroll-arrow"></div>
        </div>
      </section>

      <section id="categoria" className="section categoria-section">
        <div className="section-inner">
          <div className="section-head reveal">
            <p className="eyebrow">Categorías</p>
            <h2>Encuentra lo que<br />necesitas para tu vehículo</h2>
            <p className="section-sub">Explora nuestras categorías de productos y soluciones para movilidad eléctrica.</p>
          </div>

          <div className="categoria-grid">
            <div className="categoria-card reveal" onClick={() => setCategoriaSeleccionada('Cargadores')}>
              <div className="categoria-img-box"><img src="dist/img/Cargadores.png" alt="Cargadores" className="categoria-img" /></div>
              <h3>Cargadores</h3>
              <p>Cargadores para vehículos eléctricos de diferentes potencias y necesidades.</p>
            </div>
            <div className="categoria-card reveal" onClick={() => setCategoriaSeleccionada('Llantas')}>
              <div className="categoria-img-box"><img src="dist/img/llanta.png" alt="Llantas" className="categoria-img" /></div>
              <h3>Llantas</h3>
              <p>Llantas diseñadas para ofrecer seguridad y rendimiento en tu vehículo eléctrico.</p>
            </div>
            <div className="categoria-card reveal" onClick={() => setCategoriaSeleccionada('Baterías')}>
              <div className="categoria-img-box"><img src="dist/img/Baterias.png" alt="Baterias" className="categoria-img" /></div>
              <h3>Baterías</h3>
              <p>Soluciones de energía y baterías para mejorar la autonomía de tu vehículo.</p>
            </div>
            <div className="categoria-card reveal" onClick={() => setCategoriaSeleccionada('Cables y conectores')}>
              <div className="categoria-img-box"><img src="dist/img/Cables_y_Conectores.png" alt="Cables y Conectores" className="categoria-img" /></div>
              <h3>Cables y conectores</h3>
              <p>Cables, conectores y accesorios para realizar tus cargas de forma segura.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="section servicios-section">
        <div className="section-inner">
          <div className="section-head reveal"><p className="eyebrow">Lo que hacemos</p><h2>Todo lo que necesita<br />tu vehículo eléctrico</h2></div>
          <div className="services-grid">
            {[
              ['/img/seccion1.png', 'Mapa en tiempo real', 'Visualiza todas las estaciones de carga cerca de ti en Bogotá, con información actualizada.', 'fa-map-location-dot'],
              ['/img/seccion2.png', 'Filtro por tu vehículo', 'Registra tu auto y el sistema filtra automáticamente las estaciones compatibles.', 'fa-car-side'],
              ['/img/seccion3.png', 'Planificador de viaje', 'Calcula las paradas de recarga óptimas según tu autonomía usando rutas viales reales.', 'fa-compass'],
              ['/img/seccion4.png', 'Comunidad activa', 'Califica estaciones, reporta cargadores dañados y consulta la experiencia de otros conductores.', 'fa-star'],
              ['/img/seccion5.png', 'Historial de cargas', 'Lleva el registro de cada sesión: kWh cargados, costo estimado y estación utilizada.', 'fa-clipboard-list'],
              ['/img/seccion6.png', 'Reservas inteligentes', 'Programa tus recargas con anticipación, reserva estaciones disponibles y organiza tus viajes de forma eficiente.', 'fa-calendar-check'],
            ].map(([image, title, description, icon]) => (
              <div className="service-card reveal" key={title}>
                <div className="card-image"><img src={image} alt={title} /></div>
                <div className="card-content"><h3><i className={`fa-solid ${icon} card-icon`}></i> {title}</h3><p>{description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="Productos" className="section productos-section">
        <div className="section-inner">
          <div className="section-head reveal"><p className="eyebrow">Nuestros productos</p><h2>Soluciones para tu<br />movilidad eléctrica</h2><p className="section-sub">Conoce nuestras soluciones de carga diseñadas para vehículos eléctricos.</p></div>
          <div className="productos-grid">
            {[
              ['/img/cargador-rapido-150kw.png', 'Cargador rápido DC 150 kW', 'Cargador de alta potencia diseñado para realizar cargas rápidas y eficientes en vehículos eléctricos.', 'Carga rápida', 'CARGADOR DC', '150 kW', 'CCS2'],
              ['/img/wallbox-22kw.png', 'Cargador Wallbox 22 kW', 'Solución compacta para cargar tu vehículo eléctrico en casa, parqueaderos o espacios privados.', 'Uso residencial', 'WALLBOX', '22 kW', 'Tipo 2'],
              ['/img/cargador-portatil-74kw.png', 'Cargador Portátil 7,4 kW', 'Una alternativa práctica para realizar cargas de tu vehículo eléctrico en diferentes lugares.', 'Portátil', 'CARGADOR PORTÁTIL', '7,4 kW', 'Tipo 2'],
            ].map(([image, title, description, badge, type, power, connector]) => (
              <div className="producto-card reveal" key={title}>
                <div className="producto-image"><img src={image} alt={title} /><span className="producto-badge">{badge}</span></div>
                <div className="producto-content"><p className="producto-type">{type}</p><h3>{title}</h3><p className="producto-desc">{description}</p><div className="producto-info"><span><i className="fa-solid fa-bolt"></i> {power}</span><span><i className="fa-solid fa-plug"></i> {connector}</span></div><div className="producto-footer"><span className="producto-price">Consultar precio</span><button type="button" className="producto-btn" onClick={() => smoothTo('contacto')}>Ver producto</button></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="nosotros" className="section nosotros-section">
        <div className="nosotros-bg"><div className="banner-headline">EV CHARGE</div><div className="banner-spotlight"></div><div className="banner-diamond"></div><div className="banner-car-wrap"><img src="/img/ChatGPT Image 26 jun 2026, 08_44_00 a.m..png" className="banner-car-img" alt="EV Car with charger" /></div></div>
        <div className="nosotros-content-wrapper"><div className="nosotros-content"><p className="nosotros-eyebrow reveal">Quiénes somos</p><h2 className="nosotros-title reveal">EV Charge</h2><p className="nosotros-desc reveal">Proyecto desarrollado por aprendices ADSO del SENA.</p><p className="nosotros-desc reveal">Impulsamos la movilidad eléctrica mediante una plataforma inteligente para localizar estaciones de carga, administrar vehículos, gestionar reservas y ofrecer una mejor experiencia a los conductores de vehículos eléctricos.</p><a href="#contacto" className="btn-primary-lg nosotros-btn reveal" onClick={(e) => smoothTo('contacto', e)}>Conoce más</a></div></div>
      </section>

      <section id="cifras" className="section cifras-section">
        <div className="section-inner"><div className="section-head reveal"><p className="eyebrow">En números</p><h2>La red eléctrica que ya existe</h2></div><div className="cifras-grid">
          {[['47', 'Estaciones en Bogotá'], ['20', 'km de radio cubierto'], ['5', 'Tipos de conector'], ['100%', '% open source']].map(([num, label]) => <div className="cifra-item reveal" key={label}><div className="cifra-num">{num}</div><div className="cifra-label">{label}</div></div>)}
        </div></div>
      </section>

      <section id="contacto" className="section contacto-section">
        <div className="section-inner contacto-inner"><div className="section-head reveal"><p className="eyebrow">Contacto</p><h2>¿Tienes una estación de carga<br />que quieras registrar?</h2><p className="section-sub">Escríbenos y la agregamos al mapa.</p></div>
          <form className="contacto-form reveal" onSubmit={enviarContacto}><div className="form-row"><div className="form-field"><label>Nombre</label><input type="text" placeholder="Tu nombre" required /></div><div className="form-field"><label>Correo</label><input type="email" placeholder="correo@ejemplo.com" required /></div></div><div className="form-field"><label>Mensaje</label><textarea rows={4} placeholder="Cuéntanos sobre la estación o tu consulta..." required></textarea></div><button type="submit" className="btn-primary-lg" style={{ width: '100%', padding: '14px 36px' }}>Enviar mensaje <i className="fa-solid fa-paper-plane"></i></button>{contactSent && <p id="contacto-msg" style={{ marginTop: 12, fontSize: 13, color: '#39a900' }}>¡Mensaje enviado! Te contactaremos pronto.</p>}</form>
        </div>
      </section>

      <footer className="footer"><div className="footer-inner"><div className="footer-brand"><img src="/img/logo.png" alt="EV Charge" className="footer-logo" /><p style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '6px 0 4px' }}>EV Charge</p><p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 320 }}>Plataforma para localizar y gestionar estaciones de carga para vehículos eléctricos en Colombia.</p></div>
        <div className="footer-links"><p className="footer-title">Navegación</p><a href="#inicio">Inicio</a><a href="#categoria">Categoria</a><a href="#servicios">Servicios</a><a href="#Productos">Productos</a><a href="#nosotros">Quiénes somos</a><a href="#contacto">Contacto</a></div>
        <div className="footer-links"><p className="footer-title">Contacto</p><div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}><span><i className="fa-solid fa-envelope"></i> eevcharge@gmail.com
</span><span><i className="fa-solid fa-location-dot"></i> Bogotá D.C., Colombia</span><span><i className="fa-solid fa-phone"></i> +57 300 123 4567</span></div></div>
        <div className="footer-links"><p className="footer-title">Información</p><p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>Versión 2.0</p><p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 4px' }}>Proyecto académico SENA ADSO</p><p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Última actualización: <span className="footer-year" style={{ fontWeight: 600, color: '#fff' }}>{year}</span></p></div>
      </div><div className="footer-bottom"><p>© <span className="footer-year">{year}</span> EV Charge • Todos los derechos reservados.</p></div></footer>

      {authModalOpen && (
        <div id="auth-modal" style={{ display: 'flex' }}>
          <div className="auth-backdrop" onClick={closeAuthModal}></div>
          <div className="auth-card">
            <button className="auth-close" onClick={closeAuthModal}>✕</button>
            <img src="/img/logo.png" alt="Logo" className="auth-logo" />

            {authTab !== 'recuperar' && (
              <div className="auth-tabs">
                <button className={`auth-tab${authTab === 'login' ? ' active' : ''}`} onClick={() => switchAuthTab('login')} disabled={authLoading}>
                  Iniciar sesión
                </button>
                <button className={`auth-tab${authTab === 'registro' ? ' active' : ''}`} onClick={() => switchAuthTab('registro')} disabled={authLoading}>
                  Registrarse
                </button>
              </div>
            )}

            {/* CONTENEDOR DE ALERTA DE ERROR O ÉXITO */}
            {alert && <div id="auth-alert" className={`alert alert-${alert.type}`}>{alert.message}</div>}

            {authTab === 'login' && (
              <form id="form-login" onSubmit={doLogin}>
                <div className="form-group">
                  <label>Correo</label>
                  <input type="email" id="login-email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="correo@ejemplo.com" disabled={authLoading} />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <div className="password-box">
                    <input id="login-pass" type={showLoginPass ? 'text' : 'password'} value={loginPass} onChange={(e) => setLoginPass(e.target.value)} placeholder="••••••••" disabled={authLoading} />
                    <span className="password-eye" onClick={() => !authLoading && setShowLoginPass((value) => !value)}>
                      <i className={`fa-solid ${showLoginPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => switchAuthTab('recuperar')}
                      disabled={authLoading}
                      style={{ background: 'none', border: 'none', color: '#39a900', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary btn-block" disabled={authLoading}>
                  {authLoading ? (
                    <span className="btn-loading-content">
                      <img src="/img/logo.png" alt="Cargando..." className="logo-spinner" /> Validando credenciales...
                    </span>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>
            )}

            {authTab === 'registro' && (
              <form id="form-registro" onSubmit={doRegistro}>
                <div className="form-group"><label>Nombre</label><input type="text" value={regNombre} onChange={(e) => setRegNombre(e.target.value)} placeholder="Tu nombre" disabled={authLoading} /></div>
                <div className="form-group"><label>Apellido</label><input type="text" value={regApellido} onChange={(e) => setRegApellido(e.target.value)} placeholder="Tu apellido" disabled={authLoading} /></div>
                <div className="form-group"><label>Correo</label><input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="correo@ejemplo.com" disabled={authLoading} /></div>
                <div className="form-group"><label>Contraseña</label><div className="password-box"><input type={showRegPass ? 'text' : 'password'} value={regPass} onChange={(e) => setRegPass(e.target.value)} placeholder="Crea tu contraseña" disabled={authLoading} /><span className="password-eye" onClick={() => !authLoading && setShowRegPass((value) => !value)}><i className={`fa-solid ${showRegPass ? 'fa-eye-slash' : 'fa-eye'}`}></i></span></div><div className={`strength-bar${regPass.length ? ' show' : ''}`}><div className="strength-progress" style={{ width: `${passwordPercent}%`, background: passwordPercent < 40 ? '#e74c3c' : passwordPercent < 80 ? '#f39c12' : '#39a900' }}></div></div><ul className={`password-requisitos${regPass.length ? ' show' : ''}`}>{requirementsList.map(([key, text]) => <li key={key} className={requirements[key] ? 'ok' : ''}><i className={`fa-solid ${requirements[key] ? 'fa-check' : 'fa-xmark'}`}></i> {text}</li>)}</ul></div>
                <div className="form-group"><label>Confirmar contraseña</label><input type="password" value={regPassConfirm} onChange={(e) => setRegPassConfirm(e.target.value)} placeholder="Repite tu contraseña" disabled={authLoading} onPaste={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()} onCut={(e) => e.preventDefault()} autoComplete="off" /></div>
                <button id="btn-crear-cuenta" className="btn btn-primary btn-block" disabled={!passwordComplete || authLoading}>
                  {authLoading ? (
                    <span className="btn-loading-content">
                      <img src="/img/logo.png" alt="Cargando..." className="logo-spinner" /> Registrando cuenta...
                    </span>
                  ) : (
                    'Crear cuenta'
                  )}
                </button>
              </form>
            )}

            {authTab === 'recuperar' && (
              <OlvidarContrasena onVolverAlLogin={() => switchAuthTab('login')} />
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CATÁLOGO POR CATEGORÍA */}
      {categoriaSeleccionada && (
        <div id="categoria-modal" style={{ display: 'flex' }}>
          <div className="auth-backdrop" onClick={() => setCategoriaSeleccionada(null)}></div>
          <div className="categoria-modal-card">
            <button className="auth-close" onClick={() => setCategoriaSeleccionada(null)}>✕</button>
            <h2 className="categoria-modal-title">
              Catálogo: <span style={{ color: 'var(--green-ev)' }}>{categoriaSeleccionada}</span>
            </h2>
            
            <div className="categoria-modal-grid">
              {productosPorCategoria[categoriaSeleccionada].map((prod, i) => (
                <div key={i} className="cat-prod-card">
                  <div className="cat-prod-img">
                    <img src={prod.img} alt={prod.nombre} />
                  </div>
                  <div className="cat-prod-info">
                    <h4>{prod.nombre}</h4>
                    <p>{prod.desc}</p>
                    <span className="cat-prod-price">{prod.precio}</span>
                    <button className="btn-primary" style={{ width: '100%', marginTop: '14px' }} onClick={(e) => {
                      setCategoriaSeleccionada(null);
                      smoothTo('contacto', e);
                    }}>Me interesa</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ERROR DE SISTEMA MEJORADO */}
      {errorSistema.visible && (
        <div id="error-sistema-modal">
          <div className="auth-backdrop" onClick={() => setErrorSistema({ visible: false, mensaje: '' })}></div>
          <div className="error-sistema-card">
            <button 
              className="auth-close error-close-btn" 
              onClick={() => setErrorSistema({ visible: false, mensaje: '' })}
              aria-label="Cerrar"
            >
              ✕
            </button>
            
            <div className="error-sistema-body">
              <div className="error-img-wrapper">
                <img 
                  src="/dist/img/error-personalizado.jpg" 
                  alt="Error de conexión" 
                  className="error-sistema-img" 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <a href="https://wa.me/573165155780" className="whatsapp-btn" target="_blank" rel="noreferrer" aria-label="Contactar por WhatsApp"><i className="fa-brands fa-whatsapp"></i></a>
    </> 
  );
}

export default App;