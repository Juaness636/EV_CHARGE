export const PANELES_USUARIO = [
  { clave: 'Inicio', icono: 'house' },
  { clave: 'Vehículos', icono: 'car' },
  { clave: 'Reservas', icono: 'calendar-check' },
  { clave: 'Pagos', icono: 'credit-card' },
  { clave: 'Compras', icono: 'bag-shopping' },
  { clave: 'Cargas', icono: 'bolt' },
  { clave: 'Favoritos', icono: 'star' },
  { clave: 'Reportes', icono: 'triangle-exclamation' },
  { clave: 'Calificaciones', icono: 'star-half-stroke' },
  { clave: 'Mi perfil', icono: 'user' },
] as const;

export type PanelUsuario = (typeof PANELES_USUARIO)[number]['clave'];

export interface PropsPanel {
  // Cambia al refrescar (deslizar hacia abajo) para recargar los datos del panel.
  version: number;
  irA: (panel: PanelUsuario) => void;
}
