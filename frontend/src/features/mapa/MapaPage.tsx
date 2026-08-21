// Migrado desde public/mapa.html. Corresponde a mapa_controller.py / mapa_routes.py
// para la ruta vial; las estaciones se cargan directo de OpenChargeMap (API externa),
// igual que en el original.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import '../../styles/estilos_mapa.css';
import '../../styles/dashboard.css';
import '../../styles/admin.css';
import { useAuth } from '../../context/AuthContext';
import { AuthModal, type AuthTab } from '../../components/AuthModal';
import { obtenerRutaVial } from '../../api/mapa.api';
import { EstacionDetalle } from './components/EstacionDetalle';
import type { EstacionOCM } from './types';

const OCM_KEY = '750370f3-3d40-4082-b93c-904118ab1dc8';
const BOGOTA: [number, number] = [4.6651, -74.1204];

const ICONO_DEFAULT = L.divIcon({
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#39a900;border:3px solid #fff;box-shadow:0 0 0 2px #39a900, 0 3px 8px rgba(0,0,0,0.5);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: '',
});
const ICONO_SELECCIONADO = L.divIcon({
  html: `<div style="width:28px;height:28px;border-radius:50%;background:#f39c12;border:3px solid #fff;box-shadow:0 0 0 3px #f39c12, 0 4px 12px rgba(0,0,0,0.6);"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  className: '',
});

export function MapaPage() {
  const { usuario, logout } = useAuth();

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const marcadoresRef = useRef<L.Marker[]>([]);
  const rutaCapaRef = useRef<L.GeoJSON | null>(null);
  const usuarioMarcadorRef = useRef<L.Marker | null>(null);

  const [estaciones, setEstaciones] = useState<EstacionOCM[]>([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [estacionSeleccionada, setEstacionSeleccionada] = useState<EstacionOCM | null>(null);
  const [infoRuta, setInfoRuta] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const abrirAuthModal = (tab: AuthTab) => {
    setAuthTab(tab);
    setAuthModalOpen(true);
  };

  // Inicializa el mapa una sola vez y carga las estaciones de OpenChargeMap.
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current).setView(BOGOTA, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;

    const url = `https://api.openchargemap.io/v3/poi/?output=json&countrycode=CO&latitude=${BOGOTA[0]}&longitude=${BOGOTA[1]}&distance=20&distanceunit=KM&compact=false&verbose=false&key=${OCM_KEY}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: EstacionOCM[]) => setEstaciones(data))
      .catch((e) => console.error('OCM error:', e));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Recalcula los marcadores visibles cuando cambian las estaciones o el filtro.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    marcadoresRef.current.forEach((m) => map.removeLayer(m));
    marcadoresRef.current = [];

    const lista =
      filtro === 'TODOS'
        ? estaciones
        : estaciones.filter((st) =>
            (st.Connections || []).some((c) => (c.ConnectionType?.Title || '').toLowerCase().includes(filtro.toLowerCase())),
          );

    lista.forEach((st) => {
      if (!st.AddressInfo) return;
      const marker = L.marker([st.AddressInfo.Latitude, st.AddressInfo.Longitude], { icon: ICONO_DEFAULT }).addTo(map);
      marker.on('click', () => {
        marcadoresRef.current.forEach((m) => m.setIcon(ICONO_DEFAULT));
        marker.setIcon(ICONO_SELECCIONADO);
        setEstacionSeleccionada(st);
        setInfoRuta(null);
      });
      marcadoresRef.current.push(marker);
    });
  }, [estaciones, filtro]);

  const calcularRuta = (destLat: number, destLon: number) => {
    if (!navigator.geolocation) return alert('GPS no disponible');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const map = mapRef.current;
        if (!map) return;
        const { latitude: uLat, longitude: uLon } = pos.coords;

        if (rutaCapaRef.current) map.removeLayer(rutaCapaRef.current);
        if (usuarioMarcadorRef.current) map.removeLayer(usuarioMarcadorRef.current);
        usuarioMarcadorRef.current = L.marker([uLat, uLon]).addTo(map).bindPopup('<i class="fa-solid fa-location-dot"></i> Estás aquí').openPopup();

        try {
          const geo = await obtenerRutaVial(uLat, uLon, destLat, destLon);
          const capa = L.geoJSON(geo as GeoJSON.GeoJsonObject, { style: { color: '#39a900', weight: 5, opacity: 0.8 } }).addTo(map);
          rutaCapaRef.current = capa;
          map.fitBounds(capa.getBounds(), { padding: [50, 50] });

          const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${uLon},${uLat};${destLon},${destLat}?overview=false`;
          const osrmData = await fetch(osrmUrl).then((r) => r.json());
          if (osrmData.routes?.length) {
            const ruta = osrmData.routes[0];
            const distanciaKm = (ruta.distance / 1000).toFixed(1);
            const duracionMin = Math.round(ruta.duration / 60);
            setInfoRuta(`Distancia: ${distanciaKm} km · Tiempo estimado: ${duracionMin} min`);
          }
        } catch {
          alert('Error al calcular la ruta. Verifica que el backend esté corriendo.');
        }
      },
      () => alert('Permiso de GPS denegado.'),
    );
  };

  const nombreCompleto = usuario ? (usuario.apellido ? `${usuario.nombre} ${usuario.apellido}` : usuario.nombre) : '';

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
          <Link to="/" className="topbar-logo"><img src="/img/logo.png" alt="EV Charge" /></Link>
        </div>
        <div className="topbar-right">
          <select className="filter-select" title="Filtrar por tipo de conector" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="TODOS">Todos los conectores</option>
            <option value="CCS">CCS</option>
            <option value="Type 2">Type 2</option>
            <option value="CHAdeMO">CHAdeMO</option>
            <option value="GB/T">GB/T</option>
            <option value="J1772">J1772</option>
          </select>
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
                  {usuario.is_admin ? 'Admin' : 'Usuario'}
                </span>
              </span>
              <button className="btn-topbar-logout" onClick={logout}>Salir</button>
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
                onCalcularRuta={calcularRuta}
                onClose={() => setEstacionSeleccionada(null)}
              />
            )}
            {infoRuta && (
              <div style={{ margin: '8px 0', padding: 8, background: '#1a1a1a', borderRadius: 6, border: '2px solid #39a900', color: '#39a900', fontSize: 13, fontWeight: 600 }}>
                <i className="fa-solid fa-car"></i> {infoRuta}
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
              {usuario ? (usuario.is_admin ? 'Administrador' : 'Usuario') : '—'}
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
              <a className="anav danger" href="#" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); logout(); }}><span className="icon"><i className="fa-solid fa-right-from-bracket"></i></span> Cerrar sesión</a>
            </>
          ) : (
            <>
              <Link className="anav" to="/dashboard" onClick={() => setDrawerOpen(false)}><span className="icon"><i className="fa-solid fa-house"></i></span> Mi dashboard</Link>
              <a className="anav danger" href="#" onClick={(e) => { e.preventDefault(); setDrawerOpen(false); logout(); }}><span className="icon"><i className="fa-solid fa-right-from-bracket"></i></span> Cerrar sesión</a>
            </>
          )}
        </nav>
      </div>

      {authModalOpen && <AuthModal initialTab={authTab} onClose={() => setAuthModalOpen(false)} />}
    </>
  );
}
