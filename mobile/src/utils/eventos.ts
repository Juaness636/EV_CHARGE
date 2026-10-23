// Bus de eventos de la app. Reemplaza los CustomEvent de window que usa el web
// ('ev-charge:estaciones-actualizadas', 'ev-charge:notificaciones-actualizadas').
type Mapa = {
  'estaciones-actualizadas': { estacionId?: string; cargadorId?: string } | undefined;
  'notificaciones-actualizadas': undefined;
};

type Listener<T> = (detalle: T) => void;
const listeners = new Map<keyof Mapa, Set<Listener<never>>>();

export function emitir<K extends keyof Mapa>(evento: K, detalle?: Mapa[K]): void {
  listeners.get(evento)?.forEach((listener) => (listener as Listener<Mapa[K] | undefined>)(detalle));
}

export function escuchar<K extends keyof Mapa>(evento: K, listener: Listener<Mapa[K]>): () => void {
  if (!listeners.has(evento)) listeners.set(evento, new Set());
  const conjunto = listeners.get(evento)!;
  conjunto.add(listener as Listener<never>);
  return () => {
    conjunto.delete(listener as Listener<never>);
  };
}
