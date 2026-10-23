// Modelos y tipos TypeScript compartidos en EV Charge Móvil

export interface Usuario {
  id: string;
  nombre: string;
  apellido?: string;
  email: string;
  is_admin: boolean;
  // usuario | admin | empresa: las cuentas de empresa ven el panel de empresa.
  rol?: 'usuario' | 'admin' | 'empresa';
  compartir_nombre_reserva?: boolean;
  created_at: string;
  vehiculos_rel?: Array<{ autonomia_km?: number }>;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
  usuario: Usuario;
}

export interface PerfilOut {
  usuario: Usuario;
  vehiculo_activo: unknown | null;
}

export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'vehiculo' | 'reserva' | 'compra' | 'pago' | 'reporte' | 'favorito' | 'calificacion' | 'sistema';
  leida: boolean;
  created_at: string;
}

export interface Contacto {
  id: string;
  usuario_id?: string;
  nombre: string;
  apellido?: string;
  correo: string;
  mensaje: string;
  estado: 'pendiente' | 'respondido';
  fecha_envio: string;
}

export type CategoriaKey = 'Cargadores' | 'Llantas' | 'Baterías' | 'Cables y conectores';

export interface CategoriaInfo {
  key: CategoriaKey;
  titulo: string;
  descripcion: string;
  image: any;
}

export interface ServicioItem {
  id: string;
  titulo: string;
  descripcion: string;
  icon: string;
  image: any;
}

export interface CifraItem {
  cifra: string;
  etiqueta: string;
}

export interface FAQItem {
  pregunta: string;
  respuesta: string;
}

// Tipos para mapas nativos (react-native-maps)
export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface EstacionNativa {
  id: string | number;
  nombre: string;
  direccion: string;
  coordenadas: Coordenada;
  estado: 'operativa' | 'mantenimiento' | 'inactiva' | 'reservada';
  conectores: string[];
  potenciaKw?: number;
}
