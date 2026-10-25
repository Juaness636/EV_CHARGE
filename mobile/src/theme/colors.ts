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
  primaryLight: string;
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
  glass: string;
  glassBorder: string;
}

const base = {
  primary: '#39a900',
  primaryDim: '#2c8200',
  primaryLight: '#6ee03a',
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
  bg: '#070a08',
  bg2: '#0b100c',
  card: '#111712',
  cardElevated: '#182019',
  input: '#0b0f0c',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  text: '#f2f2f2',
  textMuted: 'rgba(240, 237, 230, 0.68)',
  textDim: '#8b949e',
  overlay: 'rgba(0, 0, 0, 0.7)',
  glass: 'rgba(13, 19, 14, 0.72)',
  glassBorder: 'rgba(110, 224, 58, 0.18)',
};

// En modo claro los colores de la marca se oscurecen para cumplir WCAG AA (4.5:1)
// como texto sobre fondos claros y con texto blanco encima; el verde #39a900 da 2.9:1.
export const lightPalette: Palette = {
  ...base,
  modo: 'light',
  primary: '#2a7300',
  primaryDim: '#215c00',
  primaryLight: '#3d9a0a',
  primarySoft: 'rgba(42, 115, 0, 0.12)',
  primaryBorder: 'rgba(42, 115, 0, 0.45)',
  error: '#c0392b',
  errorSoft: 'rgba(192, 57, 43, 0.12)',
  warning: '#875e00',
  warningSoft: 'rgba(135, 94, 0, 0.12)',
  info: '#1f6fb2',
  infoSoft: 'rgba(31, 111, 178, 0.12)',
  bg: '#eef1ec',
  bg2: '#e6eae3',
  card: '#ffffff',
  cardElevated: '#f6f8f5',
  input: '#ffffff',
  border: 'rgba(0, 0, 0, 0.12)',
  borderStrong: 'rgba(0, 0, 0, 0.26)',
  text: '#121711',
  textMuted: '#434b40',
  textDim: '#5a6357',
  overlay: 'rgba(0, 0, 0, 0.5)',
  glass: 'rgba(255, 255, 255, 0.78)',
  glassBorder: 'rgba(42, 115, 0, 0.2)',
};

// Colores de estado de estaciones (iguales al mapa web).
export const coloresEstado: Record<string, string> = {
  disponible: '#39a900',
  activa: '#39a900',
  reservada: '#3498db',
  ocupada: '#8e44ad',
  mantenimiento: '#f39c12',
  inactiva: '#e74c3c',
};
