// Mapa Leaflet para Android e iOS dentro de react-native-webview.
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { crearHtmlMapa, type ComandoMapa } from './mapaHtml';
import { usePuenteMapa, type LeafletMapHandle, type LeafletMapProps } from './usePuenteMapa';

export type { LeafletMapHandle } from './usePuenteMapa';

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(function LeafletMap({ oscuro, onEvento }, ref) {
  const webview = useRef<WebView>(null);
  // El HTML se genera una sola vez; el cambio de tema se envía como comando.
  const html = useMemo(() => crearHtmlMapa(oscuro), []);

  const transmitir = useCallback((comando: ComandoMapa) => {
    webview.current?.injectJavaScript(`window.__evRecibir && window.__evRecibir(${JSON.stringify(JSON.stringify(comando))}); true;`);
  }, []);

  const { enviar, recibir, reiniciar } = usePuenteMapa(transmitir, onEvento);
  useImperativeHandle(ref, () => ({ enviar }), [enviar]);

  return (
    <View style={styles.contenedor}>
      <WebView
        ref={webview}
        source={{ html, baseUrl: 'https://evcharge.local/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => recibir(e.nativeEvent.data)}
        onContentProcessDidTerminate={() => { reiniciar(); webview.current?.reload(); }}
        onRenderProcessGone={() => { reiniciar(); webview.current?.reload(); }}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        bounces={false}
        style={[styles.webview, { backgroundColor: oscuro ? '#0d0d0d' : '#f2f2f2' }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  contenedor: { flex: 1, overflow: 'hidden' },
  webview: { flex: 1 },
});
