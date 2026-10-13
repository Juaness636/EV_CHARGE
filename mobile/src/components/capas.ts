// Pila de capas visibles (pantalla raíz + modales abiertos).
// En Android/iOS cada <Modal> es una ventana aparte: los toasts y confirmaciones deben
// dibujarse dentro de la capa superior para que no queden ocultos detrás del modal.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// iOS no puede presentar un modal mientras otro se está cerrando: se espera la animación.
export function trasCerrarModal(accion: () => void): void {
  setTimeout(accion, Platform.OS === 'ios' ? 450 : 0);
}

let pila: string[] = [];
const oyentes = new Set<() => void>();
let contador = 0;

const avisar = () => oyentes.forEach((o) => o());

export function capaSuperior(): string {
  return pila[pila.length - 1] ?? 'raiz';
}

export function useCapa(visible: boolean): string {
  const [id] = useState(() => `capa-${++contador}`);
  useEffect(() => {
    if (!visible) return;
    pila = [...pila, id];
    avisar();
    return () => {
      pila = pila.filter((c) => c !== id);
      avisar();
    };
  }, [visible, id]);
  return id;
}

export function useEsCapaSuperior(id: string): boolean {
  const [superior, setSuperior] = useState(capaSuperior() === id);
  useEffect(() => {
    const actualizar = () => setSuperior(capaSuperior() === id);
    oyentes.add(actualizar);
    actualizar();
    return () => {
      oyentes.delete(actualizar);
    };
  }, [id]);
  return superior;
}
