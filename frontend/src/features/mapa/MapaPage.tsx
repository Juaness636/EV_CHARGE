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
import { obtenerRutaVial, planificarViajeConWaze, obtenerAlertasWaze, type PlanViajeConWaze, type AlertasAreaWaze } from '../../api/mapa.api';
import { EstacionDetalle } from './components/EstacionDetalle';
import { obtenerEstadoEstacion } from '../../api/estado.api';
import type { EstacionOCM } from './types';

const OCM_KEY = '750370f3-3d40-4082-b93c-904118ab1dc8';
const BOGOTA: [number, number] = [4.6651, -74.1204];

const colorEstado = (estado: string) => estado === 'mantenimiento' ? '#f39c12' : estado === 'inactiva' ? '#e74c3c' : '#39a900';
const crearIconoEstacion = (estado: string, seleccionado = false) => {
  const color = colorEstado(estado);
  const dimension = seleccionado ? 28 : 22;
  const sombra = seleccionado ? `0 0 0 3px ${color}, 0 4px 12px rgba(0,0,0,0.6)` : `0 0 0 2px ${color}, 0 3px 8px rgba(0,0,0,0.5)`;
  return L.divIcon({
    html: `<div style="width:${dimension}px;height:${dimension}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:${sombra};"></div>`,
    iconSize: [dimension, dimension],
    iconAnchor: [dimension / 2, dimension / 2],
    className: '',
  });
};

export function MapaPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const marcadoresRef = useRef<L.Marker[]>([]);
  const rutaCapaRef = useRef<L.GeoJSON | null>(null);
  const usuarioMarcadorRef = useRef<L.Marker | null>(null);

  const [estaciones, setEstaciones] = useState<EstacionOCM[]>([]);
  const [estadosEstaciones, setEstadosEstaciones] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState('TODOS');
  const [estacionSeleccionada, setEstacionSeleccionada] = useState<EstacionOCM | null>(null);
  const [infoRuta, setInfoRuta] = useState<string | null>(null);
  const [planViajeWaze, setPlanViajeWaze] = useState<PlanViajeConWaze | null>(null);
  const [alertasWaze, setAlertasWaze] = useState<AlertasAreaWaze | null>(null);
  const [cargandoRuta, setCargandoRuta] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('map-page');
    return () => document.body.classList.remove('map-page');
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
    const map = L.map(mapDivRef.current).setView(BOGOTA, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;

    fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/estaciones-mapa`)
      .then((r) => r.json())
      .then((data: EstacionOCM[]) => setEstaciones(data))
      .catch((e) => console.error('OCM error:', e));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!estaciones.length) return;
    let cancelado = false;
    Promise.all(estaciones.map(async (estacion) => {
      const id = String(estacion.ID);
      try {
        const estado = await obtenerEstadoEstacion(id);
        return [id, String(estado.estado || 'disponible')] as const;
      } catch {
        return [id, 'disponible'] as const;
      }
    })).then((resultados) => {
      if (!cancelado) setEstadosEstaciones(Object.fromEntries(resultados));
    });
    return () => { cancelado = true; };
  }, [estaciones]);

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
      const id = String(st.ID);
      const estado = estadosEstaciones[id] || 'disponible';
      const marker = L.marker([st.AddressInfo.Latitude, st.AddressInfo.Longitude], { icon: crearIconoEstacion(estado) }).addTo(map);
      marker.on('click', () => {
        marcadoresRef.current.forEach((m) => {
          const markerEstado = (m as L.Marker & { estadoEstacion?: string }).estadoEstacion || 'disponible';
          m.setIcon(crearIconoEstacion(markerEstado));
        });
        marker.setIcon(crearIconoEstacion(estado, true));
        setEstacionSeleccionada(st);
        setInfoRuta(null);
      });
      (marker as L.Marker & { estadoEstacion?: string }).estadoEstacion = estado;
      marcadoresRef.current.push(marker);
    });
  }, [estaciones, estadosEstaciones, filtro]);

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

        setCargandoRuta(true);
        try {
          // Usar autonomía del vehículo si existe, sino usar 300 por defecto
          const autonomia = usuario?.vehiculos_rel && usuario.vehiculos_rel.length > 0
            ? (usuario.vehiculos_rel[0].autonomia_km ?? 300)
            : 300;

          // Obtener plan de viaje con información de Waze
          const plan = await planificarViajeConWaze(uLat, uLon, destLat, destLon, autonomia);
          setPlanViajeWaze(plan);

          // Mostrar la ruta en el mapa
          const capa = L.geoJSON(plan.geometry as GeoJSON.GeoJsonObject, { 
            style: { 
              color: plan.evaluacion_waze.retraso_estimado_min > 30 ? '#e74c3c' : '#39a900', 
              weight: 5, 
              opacity: 0.8 
            } 
          }).addTo(map);
          rutaCapaRef.current = capa;
          map.fitBounds(capa.getBounds(), { padding: [50, 50] });

          // Generar información de ruta mejorada
          let infoTexto = `📍 Distancia: ${plan.distancia_total_km} km`;
          infoTexto += ` · ⏱️ Tiempo: ${plan.duracion_base_min} min`;
          
          if (plan.evaluacion_waze.disponible && plan.evaluacion_waze.retraso_estimado_min > 0) {
            infoTexto += ` ⚠️ (+${plan.evaluacion_waze.retraso_estimado_min} min con tráfico)`;
          }
          
          if (plan.paradas_sugeridas > 0) {
            infoTexto += ` · 🔌 ${plan.paradas_sugeridas} parada(s) sugerida(s)`;
          }

          setInfoRuta(infoTexto);

          // Obtener alertas del área
          const margen = 0.05;
          const latMin = Math.min(uLat, destLat) - margen;
          const latMax = Math.max(uLat, destLat) + margen;
          const lonMin = Math.min(uLon, destLon) - margen;
          const lonMax = Math.max(uLon, destLon) + margen;

          const alertas = await obtenerAlertasWaze(latMin, lonMin, latMax, lonMax);
          setAlertasWaze(alertas);

          // Mostrar alertas críticas en el mapa
          if (alertas.disponible && alertas.atascos.length > 0) {
            alertas.atascos.forEach((atasco) => {
              if (atasco.latitud && atasco.longitud && atasco.nivel_congestion === 'crítico') {
                L.circleMarker([atasco.latitud, atasco.longitud], {
                  radius: 8,
                  fillColor: '#e74c3c',
                  color: '#fff',
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.8
                }).addTo(map).bindPopup(`⚠️ Congestión crítica: ${atasco.longitud_km} km`);
              }
            });
          }

        } catch (error) {
          console.error('Error al calcular ruta:', error);
          // Fallback a la ruta simple sin Waze
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
        } finally {
          setCargandoRuta(false);
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
            {cargandoRuta && (
              <div style={{ margin: '8px 0', padding: 8, background: '#1a1a1a', borderRadius: 6, border: '2px solid #f39c12', color: '#f39c12', fontSize: 13, textAlign: 'center' }}>
                <i className="fa-solid fa-spinner fa-spin"></i> Calculando ruta con información de tráfico...
              </div>
            )}
            {planViajeWaze?.evaluacion_waze && (
              <div style={{ margin: '12px 0', padding: 12, background: '#1a1a1a', borderRadius: 6, border: '2px solid #3498db' }}>
                <div style={{ color: '#3498db', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  📊 Información de Tráfico (Waze)
                </div>
                
                {planViajeWaze.evaluacion_waze.recomendaciones.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {planViajeWaze.evaluacion_waze.recomendaciones.map((rec, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: 6,
                          marginBottom: 4,
                          background: rec.severidad === 'alta' ? 'rgba(231, 76, 60, 0.1)' : 'rgba(52, 152, 219, 0.1)',
                          border: `1px solid ${rec.severidad === 'alta' ? '#e74c3c' : '#3498db'}`,
                          borderRadius: 4,
                          color: rec.severidad === 'alta' ? '#e74c3c' : '#3498db',
                          fontSize: 12
                        }}
                      >
                        {rec.mensaje}
                      </div>
                    ))}
                  </div>
                )}

                {planViajeWaze.evaluacion_waze.resumen && (
                  <div style={{ color: '#aaa', fontSize: 11 }}>
                    <div>🚗 Atascos detectados: {planViajeWaze.evaluacion_waze.resumen.total_atascos}</div>
                    <div>⚠️ Críticos: {planViajeWaze.evaluacion_waze.resumen.atascos_criticos}</div>
                    <div>🚨 Alertas graves: {planViajeWaze.evaluacion_waze.resumen.alertas_graves}</div>
                  </div>
                )}
              </div>
            )}
            {alertasWaze?.disponible && alertasWaze.atascos.length > 0 && (
              <div style={{ margin: '12px 0', padding: 12, background: '#1a1a1a', borderRadius: 6, border: '2px solid #e74c3c', maxHeight: 150, overflowY: 'auto' }}>
                <div style={{ color: '#e74c3c', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  🚦 Atascos en la Ruta
                </div>
                {alertasWaze.atascos.map((atasco, idx) => (
                  <div key={idx} style={{ padding: 6, marginBottom: 6, background: 'rgba(231, 76, 60, 0.1)', borderRadius: 4, fontSize: 11, color: '#aaa', borderLeft: `2px solid ${atasco.nivel_congestion === 'crítico' ? '#e74c3c' : atasco.nivel_congestion === 'alto' ? '#e67e22' : '#3498db'}` }}>
                    <div><strong>{atasco.longitud_km} km</strong> - {atasco.nivel_congestion.toUpperCase()}</div>
                    <div>Velocidad: {atasco.velocidad_actual_kmh} km/h (Límite: {atasco.velocidad_limite_kmh} km/h)</div>
                    <div style={{ color: atasco.nivel_congestion === 'crítico' ? '#e74c3c' : '#f39c12' }}>⏱️ Retraso estimado: +{atasco.tiempo_retraso_min} min</div>
                  </div>
                ))}
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
