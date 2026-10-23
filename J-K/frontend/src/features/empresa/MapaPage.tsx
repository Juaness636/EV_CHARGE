// Mapa privativo de la empresa. Solo sus estaciones, con el color de marca
// y el estado operativo visible; el alta y edición se hacen en la página de estaciones.
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { EmpresaLayout, useEmpresa } from '../../layouts/EmpresaLayout';
import { listarEstaciones, type EstacionEmpresa, type EstadoEstacion } from '../../api/empresa.api';
import { BOGOTA, estadoClase } from './comunes';

const COLOR_ESTADO: Record<EstadoEstacion, string> = { activa: '#39a900', mantenimiento: '#f39c12', inactiva: '#e74c3c' };

export function EmpresaMapaPage() {
  return (
    <EmpresaLayout titulo="Mapa de la empresa">
      <Contenido />
    </EmpresaLayout>
  );
}

function Contenido() {
  const { perfil } = useEmpresa();
  const [estaciones, setEstaciones] = useState<EstacionEmpresa[]>([]);
  const [seleccionada, setSeleccionada] = useState<EstacionEmpresa | null>(null);
  const [error, setError] = useState('');

  const mapaRef = useRef<L.Map | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const marcadoresRef = useRef<L.Marker[]>([]);

  const colorMarca = perfil?.color_hex;

  useEffect(() => {
    void listarEstaciones().then(setEstaciones).catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las estaciones.'));
  }, []);

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;
    const mapa = L.map(contenedorRef.current).setView(BOGOTA, 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(mapa);
    mapaRef.current = mapa;
    return () => { mapa.remove(); mapaRef.current = null; };
  }, []);

  const icono = useMemo(() => (estacion: EstacionEmpresa, activo: boolean) => {
    const color = colorMarca || COLOR_ESTADO[estacion.estado];
    const tamano = activo ? 30 : 22;
    return L.divIcon({
      html: `<div style="width:${tamano}px;height:${tamano}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${COLOR_ESTADO[estacion.estado]};"></div>`,
      iconSize: [tamano, tamano],
      iconAnchor: [tamano / 2, tamano / 2],
      className: '',
    });
  }, [colorMarca]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    marcadoresRef.current.forEach((marcador) => mapa.removeLayer(marcador));
    marcadoresRef.current = [];

    const visibles = estaciones.filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon));
    visibles.forEach((estacion) => {
      const activo = seleccionada?.id === estacion.id;
      const marcador = L.marker([estacion.lat, estacion.lon], { icon: icono(estacion, activo) }).addTo(mapa);
      marcador.on('click', () => {
        setSeleccionada(estacion);
        mapa.setView([estacion.lat, estacion.lon], 14);
      });
      marcadoresRef.current.push(marcador);
    });

    if (visibles.length > 0 && !seleccionada) {
      mapa.fitBounds(L.latLngBounds(visibles.map((e) => [e.lat, e.lon] as [number, number])), { padding: [40, 40] });
    }
  }, [estaciones, seleccionada, icono]);

  return <>
    {error && <div className="alert alert-error">{error}</div>}

    <div className="panel-toolbar">
      <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)' }}>
        {estaciones.length} estacion(es) · <Link to="/empresa/estaciones">administrar estaciones</Link> · <Link to="/mapa">mapa publico</Link>
      </span>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
      <div ref={contenedorRef} style={{ height: 520, borderRadius: 12, overflow: 'hidden' }} />
      <div className="section-box" style={{ alignSelf: 'start' }}>
        <div className="box-title">{seleccionada ? seleccionada.nombre : 'Estaciones'}</div>
        {estaciones.length === 0 ? <p className="empty">Aun no tienes estaciones.</p> : !seleccionada ? (
          <div>
            {estaciones.map((estacion) => (
              <div className="res-row" key={estacion.id} style={{ cursor: 'pointer' }} onClick={() => { setSeleccionada(estacion); mapaRef.current?.setView([estacion.lat, estacion.lon], 14); }}>
                <span className="res-nombre">{estacion.nombre}</span>
                <span className={`status-badge ${estadoClase(estacion.estado)}`}>{estacion.estado}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13 }}>
            <div><span className={`status-badge ${estadoClase(seleccionada.estado)}`}>{seleccionada.estado}</span></div>
            <div style={{ margin: '8px 0', color: 'var(--muted)', fontSize: 12 }}>{seleccionada.direccion || 'Sin direccion'}</div>
            <div>{seleccionada.lat}, {seleccionada.lon}</div>
            <div style={{ marginTop: 8 }}>Cargadores disponibles: {seleccionada.cargadores_disponibles}/{seleccionada.total_cargadores}</div>
            <div>Incidentes abiertos: {seleccionada.incidentes_abiertos}</div>
            {seleccionada.descripcion && <div style={{ marginTop: 8, fontSize: 12 }}>{seleccionada.descripcion}</div>}
            <div style={{ marginTop: 8 }}>
              {seleccionada.cargadores.map((c) => (
                <div className="res-row" key={c.id}>
                  <span className="res-nombre">#{c.numero} {c.tipo_conector} · {c.potencia_kw} kW</span>
                  <span className={`status-badge ${estadoClase(c.estado)}`}>{c.estado}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <button className="btn-tbl" onClick={() => setSeleccionada(null)}>Ver todas</button>
              {' '}<Link className="btn-tbl primary" to="/empresa/estaciones">Editar</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  </>;
}
