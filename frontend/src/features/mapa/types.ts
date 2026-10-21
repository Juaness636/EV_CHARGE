// Forma de una estación tal como la devuelve OpenChargeMap (OCM), más los campos
// que agrega el backend para las estaciones propias y de empresa.
export interface MarcaEmpresa {
  id: string;
  nombre: string;
  color_hex: string;
  logo_url?: string | null;
  estado: 'pendiente' | 'aprobada' | 'suspendida';
}

export interface EstacionOCM {
  ID: number | string;
  AddressInfo?: {
    Title?: string;
    AddressLine1?: string;
    Latitude: number;
    Longitude: number;
  };
  OperatorInfo?: { Title?: string };
  Estado?: string;
  Origen?: 'Empresa' | 'EV Charge' | 'OpenChargeMap';
  Empresa?: MarcaEmpresa | null;
  Connections?: Array<{
    ConnectionType?: { Title?: string };
    PowerKW?: number;
    CurrentType?: { Title?: string };
    Quantity?: number;
    Estado?: string;
    CargadorId?: string;
    Numero?: number;
  }>;
}
