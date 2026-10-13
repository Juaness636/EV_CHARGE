// Paleta oficial de EV Charge (verde #39a900) en sus variantes oscura y clara,
// equivalente a las variables CSS [data-theme] del frontend web.
export interface Palette {
  modo: 'dark' | 'light';
  bg: string;
  bg2: string;
  card: string;
  cardElevated: string;
  input: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  primary: string;
  primaryDim: string;
  primarySoft: string;
  primaryBorder: string;
  neon: string;
  onPrimary: string;
  error: string;
  errorSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
}

const base = {
  primary: '#39a900',
  primaryDim: '#2c8200',
  primarySoft: 'rgba(57, 169, 0, 0.14)',
  primaryBorder: 'rgba(57, 169, 0, 0.4)',
  neon: '#39FF14',
  onPrimary: '#ffffff',
  error: '#e74c3c',
  errorSoft: 'rgba(231, 76, 60, 0.15)',
  warning: '#f39c12',
  warningSoft: 'rgba(243, 156, 18, 0.15)',
  info: '#3498db',
  infoSoft: 'rgba(52, 152, 219, 0.15)',
};

export const darkPalette: Palette = {
  ...base,
  modo: 'dark',
  bg: '#0d0d0d',
  bg2: '#111111',
  card: '#161616',
  cardElevated: '#1f1f1f',
  input: '#101010',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  text: '#f2f2f2',
  textMuted: 'rgba(240, 237, 230, 0.68)',
  textDim: '#8b949e',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export const lightPalette: Palette = {
  ...base,
  modo: 'light',
  primarySoft: 'rgba(57, 169, 0, 0.1)',
  bg: '#f5f7f4',
  bg2: '#eef1ec',
  card: '#ffffff',
  cardElevated: '#f8faf7',
  input: '#ffffff',
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.18)',
  text: '#151a14',
  textMuted: '#4b5548',
  textDim: '#6b7368',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

// Colores de estado de estaciones (iguales al mapa web).
export const coloresEstado: Record<string, string> = {
  disponible: '#39a900',
  activa: '#39a900',
  reservada: '#3498db',
  mantenimiento: '#f39c12',
  inactiva: '#e74c3c',
};
