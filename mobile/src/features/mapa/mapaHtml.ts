// Documento HTML con Leaflet que se carga en un WebView (Android/iOS) o en un iframe (Web).
// La app y el mapa se comunican con mensajes JSON:
//   App -> mapa: window.__evRecibir(mensaje)   (WebView.injectJavaScript / iframe.postMessage)
//   Mapa -> app: enviar({ tipo: 'listo' | 'estacion' | 'movido' })
export type ComandoMapa =
  | { tipo: 'estaciones'; lista: MarcadorEstacion[]; ajustar: boolean }
  | { tipo: 'seleccionar'; id: string | null }
  | { tipo: 'vista'; lat: number; lon: number; zoom?: number }
  | { tipo: 'zoom'; delta: number }
  | { tipo: 'ruta'; puntos: [number, number][] | null; ajustar: boolean }
  | { tipo: 'recorrido'; puntos: [number, number][] | null }
  | { tipo: 'usuario'; lat: number; lon: number; rumbo: number; seguir: boolean }
  | { tipo: 'quitarUsuario' }
  | { tipo: 'tema'; oscuro: boolean };

export type EventoMapa =
  | { tipo: 'listo' }
  | { tipo: 'estacion'; id: string }
  | { tipo: 'limites'; norte: number; sur: number; este: number; oeste: number }
  | { tipo: 'error'; mensaje: string };

export interface MarcadorEstacion {
  id: string;
  lat: number;
  lon: number;
  titulo: string;
  estado: string;
}

export function crearHtmlMapa(oscuro: boolean): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: ${oscuro ? '#0d0d0d' : '#f2f2f2'}; }
  .leaflet-control-attribution { font-size: 10px; }
  body.oscuro .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9) saturate(0.6); }
  body.oscuro .leaflet-control-attribution { background: rgba(20,20,20,.8); color: #aaa; }
  body.oscuro .leaflet-control-attribution a { color: #8fd16b; }
  .ev-pin { width: 34px; height: 34px; border-radius: 12px 12px 12px 4px; transform: rotate(-45deg); border: 2px solid #fff;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 12px rgba(0,0,0,.45); }
  .ev-pin i { transform: rotate(45deg); color: #fff; font-size: 15px; }
  .ev-pin.sel { width: 42px; height: 42px; }
  .ev-pin.sel i { font-size: 18px; }
  .ev-entrada { animation: evEntrada .45s cubic-bezier(.34,1.56,.64,1) both; }
  .ev-salto { animation: evSalto .6s cubic-bezier(.28,.84,.42,1) both; }
  .ev-pulso { position: absolute; inset: -6px; border-radius: 50%; animation: evPulso 1.6s ease-out infinite; pointer-events: none; }
  @keyframes evEntrada { from { opacity: 0; transform: scale(.3) translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes evSalto { 0% { transform: translateY(0); } 30% { transform: translateY(-16px); } 55% { transform: translateY(0); } 72% { transform: translateY(-6px); } 100% { transform: translateY(0); } }
  @keyframes evPulso { from { opacity: .7; transform: scale(.8); } to { opacity: 0; transform: scale(1.9); } }
  @media (prefers-reduced-motion: reduce) { .ev-entrada, .ev-salto, .ev-pulso { animation: none; } }
  .ev-car { width: 40px; height: 40px; border-radius: 50%; background: #1769ff; border: 3px solid #fff; display: flex;
    align-items: center; justify-content: center; color: #fff; font-size: 17px; box-shadow: 0 0 0 6px rgba(23,105,255,.25), 0 3px 12px rgba(0,0,0,.5); }
  .ev-cargando { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 600 14px sans-serif;
    color: ${oscuro ? '#aaa' : '#555'}; z-index: 999; pointer-events: none; }
</style>
</head>
<body class="${oscuro ? 'oscuro' : ''}">
<div id="map"></div>
<div class="ev-cargando" id="cargando">Cargando mapa…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  function enviar(msg) {
    var texto = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(texto);
    else if (window.parent && window.parent !== window) window.parent.postMessage({ __evmapa: true, datos: texto }, '*');
  }
  if (typeof L === 'undefined') {
    document.getElementById('cargando').textContent = 'No se pudo cargar el mapa. Revisa tu conexión a internet.';
    enviar({ tipo: 'error', mensaje: 'leaflet' });
    return;
  }
  var COLORES = { disponible: '#39a900', activa: '#39a900', reservada: '#3498db', mantenimiento: '#f39c12', inactiva: '#e74c3c' };
  var ICONOS = { mantenimiento: 'fa-screwdriver-wrench', inactiva: 'fa-ban', reservada: 'fa-clock' };
  var map = L.map('map', { zoomControl: false, minZoom: 5, maxBounds: [[-4.5, -81.5], [13.8, -66.5]], maxBoundsViscosity: 1 })
    .setView([4.6651, -74.1204], 12);
  // Mismas teselas de OpenStreetMap que el frontend web; el modo oscuro se logra con un filtro CSS.
  var capaBase = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, noWrap: true,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  capaBase.on('load', function () { var c = document.getElementById('cargando'); if (c) c.remove(); });
  setTimeout(function () { var c = document.getElementById('cargando'); if (c) c.remove(); }, 6000);

  // Si el contenedor todavía no tiene tamaño (el WebView/iframe se está montando),
  // el encuadre se aplica cuando el mapa obtenga sus dimensiones reales.
  var encuadrePendiente = null;
  function encuadrar(limites, opciones) {
    map.invalidateSize({ pan: false });
    var t = map.getSize();
    if (t.x < 20 || t.y < 20) { encuadrePendiente = [limites, opciones]; return; }
    encuadrePendiente = null;
    map.fitBounds(limites, opciones);
  }
  function alCambiarTamano() {
    map.invalidateSize({ pan: false });
    if (encuadrePendiente) encuadrar(encuadrePendiente[0], encuadrePendiente[1]);
  }
  window.addEventListener('resize', alCambiarTamano);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(alCambiarTamano).observe(document.getElementById('map'));

  var marcadores = {};
  var datosMarcador = {};
  var yaMostrados = {};
  var seleccionado = null;
  var capaRuta = null, capaRecorrido = null, marcadorUsuario = null;

  // animacion: 'entrada' al crear el marcador, 'salto' al seleccionarlo.
  function icono(estado, sel, animacion) {
    var color = COLORES[estado] || COLORES.disponible;
    var ic = ICONOS[estado] || 'fa-bolt';
    var tam = sel ? 42 : 34;
    var clase = animacion === 'salto' ? 'ev-salto' : animacion === 'entrada' ? 'ev-entrada' : '';
    return L.divIcon({
      className: '',
      html: '<div class="' + clase + '" style="position:relative;width:' + tam + 'px;height:' + tam + 'px">' +
        (sel ? '<div class="ev-pulso" style="background:' + color + '55"></div>' : '') +
        '<div class="ev-pin' + (sel ? ' sel' : '') + '" style="background:linear-gradient(145deg,' + color + ',' + color + 'bb);' +
        (sel ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px ' + color + ',0 6px 18px rgba(0,0,0,.6)' : '') + '"><i class="fa-solid ' + ic + '"></i></div></div>',
      iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2 + 4]
    });
  }

  function iconoUsuario(rumbo) {
    return L.divIcon({ className: '', html: '<div class="ev-car" style="transform:rotate(' + (rumbo || 0) + 'deg)"><i class="fa-solid fa-location-arrow" style="transform:rotate(-45deg)"></i></div>', iconSize: [40, 40], iconAnchor: [20, 20] });
  }

  var acciones = {
    estaciones: function (m) {
      Object.keys(marcadores).forEach(function (id) { map.removeLayer(marcadores[id]); });
      marcadores = {}; datosMarcador = {};
      var puntos = [];
      m.lista.forEach(function (e) {
        var mk = L.marker([e.lat, e.lon], { icon: icono(e.estado, e.id === seleccionado, yaMostrados[e.id] ? null : 'entrada') }).addTo(map);
        yaMostrados[e.id] = true;
        mk.bindTooltip(e.titulo, { direction: 'top', offset: [0, -14] });
        mk.on('click', function () { acciones.seleccionar({ id: e.id }); enviar({ tipo: 'estacion', id: e.id }); });
        marcadores[e.id] = mk; datosMarcador[e.id] = e;
        puntos.push([e.lat, e.lon]);
      });
      if (m.ajustar && puntos.length) encuadrar(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 14 });
    },
    seleccionar: function (m) {
      if (seleccionado && marcadores[seleccionado]) marcadores[seleccionado].setIcon(icono(datosMarcador[seleccionado].estado, false));
      seleccionado = m.id;
      if (m.id && marcadores[m.id]) {
        marcadores[m.id].setIcon(icono(datosMarcador[m.id].estado, true, 'salto'));
        marcadores[m.id].setZIndexOffset(1000);
      }
    },
    vista: function (m) { map.setView([m.lat, m.lon], m.zoom || Math.max(map.getZoom(), 15), { animate: true }); },
    zoom: function (m) { map.setZoom(map.getZoom() + m.delta); },
    ruta: function (m) {
      if (capaRuta) { map.removeLayer(capaRuta); capaRuta = null; }
      if (m.puntos && m.puntos.length) {
        capaRuta = L.polyline(m.puntos, { color: '#1769ff', weight: 7, opacity: 0.95 }).addTo(map);
        if (m.ajustar) encuadrar(capaRuta.getBounds(), { padding: [50, 50] });
      }
    },
    recorrido: function (m) {
      if (capaRecorrido) { map.removeLayer(capaRecorrido); capaRecorrido = null; }
      if (m.puntos && m.puntos.length > 1) capaRecorrido = L.polyline(m.puntos, { color: '#8b949e', weight: 8, opacity: 0.95 }).addTo(map);
    },
    usuario: function (m) {
      if (!marcadorUsuario) marcadorUsuario = L.marker([m.lat, m.lon], { icon: iconoUsuario(m.rumbo), zIndexOffset: 2000 }).addTo(map);
      else { marcadorUsuario.setLatLng([m.lat, m.lon]); marcadorUsuario.setIcon(iconoUsuario(m.rumbo)); }
      if (m.seguir) map.setView([m.lat, m.lon], Math.max(map.getZoom(), 15), { animate: true });
    },
    quitarUsuario: function () { if (marcadorUsuario) { map.removeLayer(marcadorUsuario); marcadorUsuario = null; } },
    tema: function (m) {
      document.body.classList.toggle('oscuro', !!m.oscuro);
      document.body.style.background = m.oscuro ? '#0d0d0d' : '#f2f2f2';
    }
  };

  window.__evRecibir = function (msg) {
    try {
      var m = typeof msg === 'string' ? JSON.parse(msg) : msg;
      if (acciones[m.tipo]) acciones[m.tipo](m);
    } catch (e) { enviar({ tipo: 'error', mensaje: String(e) }); }
  };
  window.addEventListener('message', function (ev) {
    if (ev.data && ev.data.__evcomando) window.__evRecibir(ev.data.datos);
  });
  var temporizadorLimites = null;
  map.on('moveend', function () {
    clearTimeout(temporizadorLimites);
    temporizadorLimites = setTimeout(function () {
      var b = map.getBounds();
      enviar({ tipo: 'limites', norte: b.getNorth(), sur: b.getSouth(), este: b.getEast(), oeste: b.getWest() });
    }, 400);
  });
  enviar({ tipo: 'listo' });
})();
</script>
</body>
</html>`;
}
