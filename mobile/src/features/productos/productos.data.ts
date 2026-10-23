// Catálogo de productos (igual a features/productos/productos.data.ts del web).
// Las imágenes se cargan con require() para que Metro las empaquete en todas las plataformas.
import type { ImageSourcePropType } from 'react-native';

export type CategoriaKey = 'Cargadores' | 'Llantas' | 'Baterías' | 'Cables y conectores';

export type ProductoCatalogo = {
  nombre: string;
  desc: string;
  monto: number;
  img: ImageSourcePropType;
  categoria: CategoriaKey;
  etiqueta: string;
  tipo: string;
  potencia: string;
  conector: string;
  // Ficha detallada que se muestra al abrir el producto.
  detalle: string;
  destacados: Array<{ icono: string; texto: string }>;
  especificaciones: Array<[string, string]>;
  incluye: string[];
  garantia: string;
};

const imagenes = {
  rapido: require('../../../assets/images/productos/cargador-rapido-150kw.jpg'),
  wallbox: require('../../../assets/images/productos/wallbox-22kw.jpg'),
  portatil: require('../../../assets/images/productos/cargador-portatil-74kw.jpg'),
  llanta: require('../../../assets/images/productos/llanta.jpg'),
  bateria: require('../../../assets/images/productos/bateria.jpg'),
  cable: require('../../../assets/images/productos/cable.jpg'),
  adaptador: require('../../../assets/images/productos/adaptador.jpg'),
};

// Identidad visual de cada categoría en la vitrina: color de acento, luz de estudio y fondo.
// El escenario de producto siempre es oscuro (estudio fotográfico), también en modo claro.
export type EstiloCategoria = { acento: string; acentoSuave: string; fondo: [string, string, string]; lema: string };

export const estiloCategoria: Record<CategoriaKey, EstiloCategoria> = {
  Cargadores: { acento: '#39ff14', acentoSuave: 'rgba(57, 255, 20, 0.16)', fondo: ['#0f2a12', '#070d08', '#020302'], lema: 'Energía' },
  Llantas: { acento: '#cfd8e3', acentoSuave: 'rgba(207, 216, 227, 0.14)', fondo: ['#2a2f35', '#101215', '#040506'], lema: 'Agarre' },
  'Baterías': { acento: '#ffb347', acentoSuave: 'rgba(255, 179, 71, 0.16)', fondo: ['#2e1d0c', '#100c08', '#040302'], lema: 'Autonomía' },
  'Cables y conectores': { acento: '#22d3ee', acentoSuave: 'rgba(34, 211, 238, 0.16)', fondo: ['#08303a', '#061114', '#020405'], lema: 'Conexión' },
};

export const categoriasProducto: CategoriaKey[] = ['Cargadores', 'Llantas', 'Baterías', 'Cables y conectores'];

export const infoCategorias: Array<{ key: CategoriaKey; descripcion: string; img: ImageSourcePropType; icono: string }> = [
  { key: 'Cargadores', descripcion: 'Cargadores para vehículos eléctricos de diferentes potencias y necesidades.', img: imagenes.rapido, icono: 'charging-station' },
  { key: 'Llantas', descripcion: 'Llantas diseñadas para ofrecer seguridad y rendimiento en tu vehículo eléctrico.', img: imagenes.llanta, icono: 'circle-notch' },
  { key: 'Baterías', descripcion: 'Soluciones de energía y baterías para mejorar la autonomía de tu vehículo.', img: imagenes.bateria, icono: 'car-battery' },
  { key: 'Cables y conectores', descripcion: 'Cables, conectores y accesorios para realizar tus cargas de forma segura.', img: imagenes.cable, icono: 'plug' },
];

export const catalogoProductos: ProductoCatalogo[] = [
  {
    nombre: 'Cargador Rápido DC 150 kW', desc: 'Ideal para estaciones comerciales de carga ultra rápida.', monto: 165000000, img: imagenes.rapido,
    categoria: 'Cargadores', etiqueta: 'Carga rápida', tipo: 'CARGADOR DC', potencia: '150 kW', conector: 'CCS2',
    detalle: 'Estación de carga rápida en corriente continua para electrolineras, centros comerciales y flotas. Lleva la batería de un vehículo típico del 10 % al 80 % en unos 20 minutos y atiende dos vehículos a la vez.',
    destacados: [{ icono: 'bolt', texto: '10–80 % en ~20 min' }, { icono: 'plug', texto: 'Doble manguera CCS2 + CHAdeMO' }, { icono: 'display', texto: 'Pantalla táctil de 10"' }, { icono: 'wifi', texto: 'Gestión remota OCPP 1.6J' }],
    especificaciones: [['Potencia máxima', '150 kW DC'], ['Tensión de salida', '200 – 1000 V DC'], ['Corriente máxima', '250 A'], ['Conectores', 'CCS2 y CHAdeMO'], ['Eficiencia', '≥ 95 %'], ['Protección', 'IP55 · IK10'], ['Dimensiones', '1900 × 750 × 600 mm']],
    incluye: ['Gabinete con dos mangueras de 5 m', 'Lector RFID y pago con tarjeta', 'Instalación y puesta en marcha', 'Capacitación al personal'],
    garantia: '3 años',
  },
  {
    nombre: 'Wallbox Inteligente 22 kW', desc: 'La solución compacta perfecta para tu casa o garaje.', monto: 7800000, img: imagenes.wallbox,
    categoria: 'Cargadores', etiqueta: 'Uso residencial', tipo: 'WALLBOX', potencia: '22 kW', conector: 'Tipo 2',
    detalle: 'Cargador de pared para casa, conjunto residencial u oficina. Programa la carga en horas valle desde la app y protege tu instalación con balanceo dinámico de potencia.',
    destacados: [{ icono: 'house', texto: 'Instalación en pared o pedestal' }, { icono: 'mobile-screen', texto: 'Control desde la app (Wi-Fi)' }, { icono: 'clock', texto: 'Carga programada en horas valle' }, { icono: 'shield-halved', texto: 'Protección diferencial tipo B' }],
    especificaciones: [['Potencia', '22 kW trifásico · 7,4 kW monofásico'], ['Corriente', '6 – 32 A ajustable'], ['Conector', 'Tipo 2 (IEC 62196-2)'], ['Cable', '5 m integrado'], ['Conectividad', 'Wi-Fi, Bluetooth, OCPP'], ['Protección', 'IP65 · IK08']],
    incluye: ['Wallbox con cable de 5 m', 'Soporte de pared y tornillería', 'Tarjeta RFID (2 unidades)', 'Manual de instalación'],
    garantia: '2 años',
  },
  {
    nombre: 'Cargador Portátil 7,4 kW', desc: 'Llévalo contigo en el baúl a todas partes.', monto: 2400000, img: imagenes.portatil,
    categoria: 'Cargadores', etiqueta: 'Portátil', tipo: 'CARGADOR PORTÁTIL', potencia: '7,4 kW', conector: 'Tipo 2',
    detalle: 'Cargador de emergencia que se conecta a un tomacorriente doméstico o industrial. Pantalla con el estado de la carga y corriente ajustable para cuidar la instalación donde estés.',
    destacados: [{ icono: 'suitcase', texto: 'Estuche de transporte incluido' }, { icono: 'sliders', texto: 'Corriente ajustable 8 – 32 A' }, { icono: 'temperature-half', texto: 'Sensor de temperatura en el enchufe' }, { icono: 'droplet', texto: 'Resistente al agua IP67' }],
    especificaciones: [['Potencia', 'Hasta 7,4 kW'], ['Entrada', '110 / 220 V AC'], ['Conector al vehículo', 'Tipo 2'], ['Cable', '6 m'], ['Peso', '2,8 kg'], ['Protección', 'IP67']],
    incluye: ['Cargador con pantalla LED', 'Adaptador a toma doméstica', 'Estuche rígido', 'Tapa protectora del conector'],
    garantia: '1 año',
  },
  {
    nombre: 'Llanta Michelin Pilot Sport EV 20"', desc: 'Alto rendimiento, bajo ruido y diseñada para el torque eléctrico.', monto: 2650000, img: imagenes.llanta,
    categoria: 'Llantas', etiqueta: 'Rendimiento', tipo: 'LLANTAS EV', potencia: '20 pulgadas', conector: 'Vehículos eléctricos',
    detalle: 'Llanta deportiva pensada para el par instantáneo de los motores eléctricos. Su compuesto reduce el ruido dentro de la cabina y mantiene el agarre en mojado.',
    destacados: [{ icono: 'volume-low', texto: 'Hasta 20 % menos ruido en cabina' }, { icono: 'gauge-high', texto: 'Soporta el torque instantáneo' }, { icono: 'cloud-rain', texto: 'Agarre superior en mojado' }, { icono: 'road', texto: 'Mayor duración de la banda' }],
    especificaciones: [['Medida', '255/40 ZR20'], ['Índice de carga / velocidad', '101Y XL'], ['Tipo', 'Radial sin cámara'], ['Etiqueta de ruido', '70 dB'], ['Uso', 'Sedán y SUV eléctricos']],
    incluye: ['1 llanta', 'Válvula nueva', 'Montaje y balanceo en taller aliado'],
    garantia: '5 años contra defectos de fabricación',
  },
  {
    nombre: 'Llanta Hankook iON evo 22"', desc: 'Optimiza la autonomía con menor resistencia a la rodadura.', monto: 3200000, img: imagenes.llanta,
    categoria: 'Llantas', etiqueta: 'Eficiencia', tipo: 'LLANTAS EV', potencia: '22 pulgadas', conector: 'Vehículos eléctricos',
    detalle: 'Llanta de baja resistencia a la rodadura que ayuda a sumar kilómetros por carga. Ideal para SUV eléctricos con rines grandes y conducción en carretera.',
    destacados: [{ icono: 'leaf', texto: 'Hasta 7 % más autonomía' }, { icono: 'wind', texto: 'Perfil aerodinámico' }, { icono: 'weight-hanging', texto: 'Estructura reforzada para SUV' }, { icono: 'volume-low', texto: 'Espuma interna antirruido' }],
    especificaciones: [['Medida', '275/35 R22'], ['Índice de carga / velocidad', '104W XL'], ['Resistencia a la rodadura', 'Clase A'], ['Etiqueta de ruido', '68 dB'], ['Uso', 'SUV eléctricos']],
    incluye: ['1 llanta', 'Válvula nueva', 'Montaje y balanceo en taller aliado'],
    garantia: '5 años contra defectos de fabricación',
  },
  {
    nombre: 'Módulo de Batería 48V', desc: 'Repuesto de celdas de iones de litio de alta densidad.', monto: 6800000, img: imagenes.bateria,
    categoria: 'Baterías', etiqueta: 'Alto rendimiento', tipo: 'BATERÍA EV', potencia: '48 V', conector: 'Iones de litio',
    detalle: 'Módulo LiFePO4 con sistema de gestión (BMS) integrado que equilibra las celdas y protege contra sobrecarga, descarga profunda y temperatura alta.',
    destacados: [{ icono: 'battery-full', texto: '4,8 kWh de energía útil' }, { icono: 'rotate', texto: 'Más de 6000 ciclos' }, { icono: 'microchip', texto: 'BMS con monitoreo por celda' }, { icono: 'fire-extinguisher', texto: 'Química LiFePO4 más segura' }],
    especificaciones: [['Tensión nominal', '48 V'], ['Capacidad', '100 Ah · 4,8 kWh'], ['Química', 'LiFePO4'], ['Ciclos de vida', '> 6000 al 80 %'], ['Temperatura de operación', '−10 a 55 °C'], ['Protección', 'IP67'], ['Peso', '42 kg']],
    incluye: ['Módulo con BMS', 'Juego de cables de potencia', 'Sensor de temperatura', 'Revisión técnica de instalación'],
    garantia: '3 años',
  },
  {
    nombre: 'Batería Auxiliar 12V EV', desc: 'Soporte para los sistemas electrónicos del vehículo.', monto: 1150000, img: imagenes.bateria,
    categoria: 'Baterías', etiqueta: 'Auxiliar', tipo: 'BATERÍA EV', potencia: '12 V', conector: 'Auxiliar',
    detalle: 'Batería AGM sellada que alimenta luces, pantallas y computadores del vehículo. Si falla, el auto no "despierta" aunque la batería principal esté llena.',
    destacados: [{ icono: 'lock', texto: 'Sellada, sin mantenimiento' }, { icono: 'eye', texto: 'Indicador visual de estado' }, { icono: 'snowflake', texto: 'Arranque confiable en frío' }, { icono: 'recycle', texto: 'Reciclamos tu batería usada' }],
    especificaciones: [['Tensión', '12 V'], ['Capacidad', '60 Ah'], ['Tecnología', 'AGM'], ['Corriente de arranque', '680 A (EN)'], ['Dimensiones', '242 × 175 × 190 mm'], ['Peso', '17,5 kg']],
    incluye: ['Batería AGM', 'Instalación a domicilio en Bogotá', 'Recolección de la batería usada'],
    garantia: '2 años',
  },
  {
    nombre: 'Cable Tipo 2 a Tipo 2 (5 m)', desc: 'Soporta carga trifásica de hasta 22 kW.', monto: 1350000, img: imagenes.cable,
    categoria: 'Cables y conectores', etiqueta: 'Carga segura', tipo: 'CABLE', potencia: '22 kW', conector: 'Tipo 2',
    detalle: 'Cable para cargar en estaciones públicas de corriente alterna que no tienen manguera propia. Revestimiento TPU flexible que no se endurece con el frío.',
    destacados: [{ icono: 'bolt', texto: 'Trifásico hasta 22 kW' }, { icono: 'ruler-horizontal', texto: '5 m de alcance' }, { icono: 'droplet', texto: 'Conectores IP54' }, { icono: 'bag-shopping', texto: 'Bolso de transporte' }],
    especificaciones: [['Corriente', '32 A trifásico'], ['Potencia', 'Hasta 22 kW'], ['Conectores', 'Tipo 2 macho ↔ Tipo 2 hembra'], ['Longitud', '5 m'], ['Revestimiento', 'TPU'], ['Norma', 'IEC 62196-2']],
    incluye: ['Cable de 5 m', 'Bolso de transporte', 'Tapas protectoras'],
    garantia: '2 años',
  },
  {
    nombre: 'Adaptador CCS2 a GB/T', desc: 'Compatibilidad con el estándar de carga chino.', monto: 2400000, img: imagenes.adaptador,
    categoria: 'Cables y conectores', etiqueta: 'Adaptador', tipo: 'ADAPTADOR', potencia: 'CCS2', conector: 'GB/T',
    detalle: 'Permite que un vehículo con entrada GB/T (común en marcas chinas) use cargadores rápidos CCS2. Incluye verificación de comunicación para cargar con seguridad.',
    destacados: [{ icono: 'bolt', texto: 'Carga rápida DC hasta 250 A' }, { icono: 'arrows-left-right', texto: 'CCS2 → GB/T' }, { icono: 'temperature-half', texto: 'Monitoreo de temperatura' }, { icono: 'shield-halved', texto: 'Bloqueo durante la carga' }],
    especificaciones: [['Entrada', 'CCS2 (Combo 2)'], ['Salida', 'GB/T DC'], ['Corriente máxima', '250 A'], ['Tensión máxima', '1000 V DC'], ['Protección', 'IP54'], ['Peso', '3,1 kg']],
    incluye: ['Adaptador', 'Estuche de transporte', 'Guía rápida de uso'],
    garantia: '1 año',
  },
];
