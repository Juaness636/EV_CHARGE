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
};

const imagenes = {
  rapido: require('../../../assets/images/cargador-rapido-150kw.png'),
  wallbox: require('../../../assets/images/wallbox-22kw.png'),
  portatil: require('../../../assets/images/cargador-portatil-74kw.png'),
  llanta: require('../../../assets/images/producto-llanta.svg'),
  bateria: require('../../../assets/images/producto-bateria.svg'),
  cable: require('../../../assets/images/producto-cable.svg'),
};

export const categoriasProducto: CategoriaKey[] = ['Cargadores', 'Llantas', 'Baterías', 'Cables y conectores'];

export const infoCategorias: Array<{ key: CategoriaKey; descripcion: string; img: ImageSourcePropType; icono: string }> = [
  { key: 'Cargadores', descripcion: 'Cargadores para vehículos eléctricos de diferentes potencias y necesidades.', img: imagenes.wallbox, icono: 'charging-station' },
  { key: 'Llantas', descripcion: 'Llantas diseñadas para ofrecer seguridad y rendimiento en tu vehículo eléctrico.', img: imagenes.llanta, icono: 'circle-notch' },
  { key: 'Baterías', descripcion: 'Soluciones de energía y baterías para mejorar la autonomía de tu vehículo.', img: imagenes.bateria, icono: 'car-battery' },
  { key: 'Cables y conectores', descripcion: 'Cables, conectores y accesorios para realizar tus cargas de forma segura.', img: imagenes.cable, icono: 'plug' },
];

export const catalogoProductos: ProductoCatalogo[] = [
  { nombre: 'Cargador Rápido DC 150 kW', desc: 'Ideal para estaciones comerciales de carga ultra rápida.', monto: 165000000, img: imagenes.rapido, categoria: 'Cargadores', etiqueta: 'Carga rápida', tipo: 'CARGADOR DC', potencia: '150 kW', conector: 'CCS2' },
  { nombre: 'Wallbox Inteligente 22 kW', desc: 'La solución compacta perfecta para tu casa o garaje.', monto: 7800000, img: imagenes.wallbox, categoria: 'Cargadores', etiqueta: 'Uso residencial', tipo: 'WALLBOX', potencia: '22 kW', conector: 'Tipo 2' },
  { nombre: 'Cargador Portátil 7,4 kW', desc: 'Llévalo contigo en el baúl a todas partes.', monto: 2400000, img: imagenes.portatil, categoria: 'Cargadores', etiqueta: 'Portátil', tipo: 'CARGADOR PORTÁTIL', potencia: '7,4 kW', conector: 'Tipo 2' },
  { nombre: 'Llanta Michelin Pilot Sport EV 20"', desc: 'Alto rendimiento, bajo ruido y diseñada para el torque eléctrico.', monto: 2650000, img: imagenes.llanta, categoria: 'Llantas', etiqueta: 'Rendimiento', tipo: 'LLANTAS EV', potencia: '20 pulgadas', conector: 'Vehículos eléctricos' },
  { nombre: 'Llanta Hankook iON evo 22"', desc: 'Optimiza la autonomía con menor resistencia a la rodadura.', monto: 3200000, img: imagenes.llanta, categoria: 'Llantas', etiqueta: 'Eficiencia', tipo: 'LLANTAS EV', potencia: '22 pulgadas', conector: 'Vehículos eléctricos' },
  { nombre: 'Módulo de Batería 48V', desc: 'Repuesto de celdas de iones de litio de alta densidad.', monto: 6800000, img: imagenes.bateria, categoria: 'Baterías', etiqueta: 'Alto rendimiento', tipo: 'BATERÍA EV', potencia: '48 V', conector: 'Iones de litio' },
  { nombre: 'Batería Auxiliar 12V EV', desc: 'Soporte para los sistemas electrónicos del vehículo.', monto: 1150000, img: imagenes.bateria, categoria: 'Baterías', etiqueta: 'Auxiliar', tipo: 'BATERÍA EV', potencia: '12 V', conector: 'Auxiliar' },
  { nombre: 'Cable Tipo 2 a Tipo 2 (5 m)', desc: 'Soporta carga trifásica de hasta 22 kW.', monto: 1350000, img: imagenes.cable, categoria: 'Cables y conectores', etiqueta: 'Carga segura', tipo: 'CABLE', potencia: '22 kW', conector: 'Tipo 2' },
  { nombre: 'Adaptador CCS2 a GB/T', desc: 'Compatibilidad con el estándar de carga chino.', monto: 2400000, img: imagenes.cable, categoria: 'Cables y conectores', etiqueta: 'Adaptador', tipo: 'ADAPTADOR', potencia: 'CCS2', conector: 'GB/T' },
];
