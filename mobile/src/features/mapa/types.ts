// Forma de una estación tal como la devuelve OpenChargeMap (OCM).
export interface EstacionOCM {
  ID: number | string;
  City?: string;
  ciudad?: string;
  departamento?: string;
  StateOrProvince?: string;
  AddressInfo?: {
    Title?: string;
    AddressLine1?: string;
    Town?: string;
    City?: string;
    StateOrProvince?: string;
    Latitude: number;
    Longitude: number;
  };
  OperatorInfo?: { Title?: string };
  // Presente en estaciones de empresas aprobadas: nombre y color de marca (RN-E10).
  Empresa?: { id: string; nombre: string; color_hex: string; logo_url?: string | null; estado: string } | null;
  // Fotos que subió la empresa dueña: rutas /media/... relativas al backend.
  Fotos?: string[];
  Connections?: Array<{
    ID?: string | null;
    ConnectionType?: { Title?: string };
    PowerKW?: number;
    CurrentType?: { Title?: string };
    Quantity?: number;
    Estado?: 'disponible' | 'fuera_servicio';
  }>;
}
