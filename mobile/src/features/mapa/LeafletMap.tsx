// Mapa Leaflet para Android e iOS dentro de react-native-webview.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Boton } from '../../components/ui';
import { crearHtmlMapa, type ComandoMapa } from './mapaHtml';
import { usePuenteMapa, type LeafletMapHandle, type LeafletMapProps } from './usePuenteMapa';

export type { LeafletMapHandle } from './usePuenteMapa';

// Leaflet prueba tres CDN de 8 s cada uno; pasado este tiempo sin "listo" se ofrece reintentar.
const ESPERA_MAXIMA_MS = 30000;

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap({ oscuro, onEvento }, ref) {
  const webview = useRef<WebView>(null);
  // El HTML se genera una sola vez; el cambio de tema se envía como comando.
  const html = useMemo(() => crearHtmlMapa(oscuro), []);
  // Cambiar la clave vuelve a montar el WebView desde cero al reintentar.
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState(false);

  const transmitir = useCallback((comando: ComandoMapa) => {
    webview.current?.injectJavaScript(`window.__evRecibir && window.__evRecibir(${JSON.stringify(JSON.stringify(comando))}); true;`);
  }, []);

  const { enviar, recibir, reiniciar } = usePuenteMapa(transmitir, onEvento);
  useImperativeHandle(ref, () => ({ enviar }), [enviar]);

  const listo = useRef(false);
  useEffect(() => {
    listo.current = false;
    const temporizador = setTimeout(() => { if (!listo.current) setFallo(true); }, ESPERA_MAXIMA_MS);
    return () => clearTimeout(temporizador);
  }, [intento]);

  const alMensaje = useCallback((texto: string) => {
    if (texto.includes('"listo"')) { listo.current = true; setFallo(false); }
    else if (texto.includes('"leaflet"')) setFallo(true);
    recibir(texto);
  }, [recibir]);

  const reintentar = () => {
    reiniciar();
    setFallo(false);
    setIntento((n) => n + 1);
  };

  return (
    <View style={styles.contenedor}>
      <WebView
        key={intento}
        ref={webview}
        source={{ html, baseUrl: 'https://evcharge.local/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onMessage={(e) => alMensaje(e.nativeEvent.data)}
        onError={() => setFallo(true)}
        onContentProcessDidTerminate={() => { reiniciar(); webview.current?.reload(); }}
        onRenderProcessGone={() => { reiniciar(); webview.current?.reload(); }}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
        style={[styles.webview, { backgroundColor: oscuro ? '#0d0d0d' : '#f2f2f2' }]}
      />
      {fallo && (
        <View style={[styles.aviso, { backgroundColor: oscuro ? '#0d0d0d' : '#f2f2f2' }]}>
          <Text style={[styles.avisoTitulo, { color: oscuro ? '#fff' : '#202020' }]}>No pudimos mostrar el mapa</Text>
          <Text style={[styles.avisoTexto, { color: oscuro ? '#aaa' : '#555' }]}>Revisa que tu celular tenga internet y vuelve a intentarlo.</Text>
          <Boton titulo="Reintentar" icono="rotate-right" onPress={reintentar} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  contenedor: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1 },
  aviso: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  avisoTitulo: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  avisoTexto: { fontSize: 13.5, textAlign: 'center', lineHeight: 19, marginBottom: 6 },
});
