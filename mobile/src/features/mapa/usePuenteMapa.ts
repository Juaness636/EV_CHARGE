// Lógica compartida por LeafletMap (WebView) y LeafletMap.web (iframe):
// cola de comandos hasta que el mapa avisa "listo" y reenvío del estado si el mapa se recarga.
import { useCallback, useRef } from 'react';
import type { ComandoMapa, EventoMapa } from './mapaHtml';

export interface LeafletMapHandle {
  enviar: (comando: ComandoMapa) => void;
}

export interface LeafletMapProps {
  oscuro: boolean;
  onEvento?: (evento: EventoMapa) => void;
}

// Comandos que describen estado (se reenvían si el mapa se recarga). Los demás son acciones puntuales.
const CLAVE_ESTADO: Partial<Record<ComandoMapa['tipo'], string>> = {
  estaciones: 'estaciones',
  seleccionar: 'seleccionar',
  ruta: 'ruta',
  recorrido: 'recorrido',
  usuario: 'usuario',
  quitarUsuario: 'usuario',
  tema: 'tema',
};

export function usePuenteMapa(transmitir: (comando: ComandoMapa) => void, onEvento?: (evento: EventoMapa) => void) {
  const listo = useRef(false);
  const estado = useRef(new Map<string, ComandoMapa>());
  const pendientes = useRef<ComandoMapa[]>([]);

  const enviar = useCallback((comando: ComandoMapa) => {
    const clave = CLAVE_ESTADO[comando.tipo];
    if (clave) {
      // Al reenviar el estado nunca se vuelve a encuadrar el mapa automáticamente.
      const guardado = comando.tipo === 'estaciones' || comando.tipo === 'ruta' ? { ...comando, ajustar: false } : comando;
      estado.current.set(clave, guardado);
    }
    if (listo.current) transmitir(comando);
    else if (!clave) pendientes.current.push(comando);
    else pendientes.current = pendientes.current.filter((c) => CLAVE_ESTADO[c.tipo] !== clave).concat(comando);
  }, [transmitir]);

  const recibir = useCallback((texto: string) => {
    let evento: EventoMapa;
    try {
      evento = JSON.parse(texto) as EventoMapa;
    } catch {
      return;
    }
    if (evento.tipo === 'listo') {
      const reenviados = new Set<string>();
      if (listo.current) {
        // El documento se recargó: se reenvía todo el estado conocido.
        estado.current.forEach((comando, clave) => { reenviados.add(clave); transmitir(comando); });
      }
      listo.current = true;
      pendientes.current.forEach((comando) => {
        const clave = CLAVE_ESTADO[comando.tipo];
        if (!clave || !reenviados.has(clave)) transmitir(comando);
      });
      pendientes.current = [];
    }
    onEvento?.(evento);
  }, [transmitir, onEvento]);

  const reiniciar = useCallback(() => {
    // El WebView perdió el documento (por ejemplo, Android liberó memoria): se reenviará el estado.
    pendientes.current = Array.from(estado.current.values());
    listo.current = false;
  }, []);

  return { enviar, recibir, reiniciar };
}
