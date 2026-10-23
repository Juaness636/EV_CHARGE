// Mapa Leaflet para la versión web (PC y navegadores móviles) dentro de un iframe.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { crearHtmlMapa, type ComandoMapa } from './mapaHtml';
import { usePuenteMapa, type LeafletMapHandle, type LeafletMapProps } from './usePuenteMapa';

export type { LeafletMapHandle } from './usePuenteMapa';

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap({ oscuro, onEvento }, ref) {
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => crearHtmlMapa(oscuro), []);

  const transmitir = useCallback((comando: ComandoMapa) => {
    iframe.current?.contentWindow?.postMessage({ __evcomando: true, datos: JSON.stringify(comando) }, '*');
  }, []);

  const { enviar, recibir } = usePuenteMapa(transmitir, onEvento);
  useImperativeHandle(ref, () => ({ enviar }), [enviar]);

  useEffect(() => {
    const alRecibir = (evento: MessageEvent) => {
      if (evento.source !== iframe.current?.contentWindow) return;
      const datos = evento.data as { __evmapa?: boolean; datos?: string };
      if (datos?.__evmapa && typeof datos.datos === 'string') recibir(datos.datos);
    };
    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
  }, [recibir]);

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      {React.createElement('iframe', {
        ref: iframe,
        srcDoc: html,
        title: 'Mapa de estaciones EV Charge',
        allow: 'geolocation',
        style: { border: 0, width: '100%', height: '100%', display: 'block', background: oscuro ? '#0d0d0d' : '#f2f2f2' },
      })}
    </View>
  );
});
