// Estados de error con el estilo neón de la app: un mensaje distinto para cada causa
// (sin internet, servidor caído, sesión vencida...) y un botón para reintentar.
// También incluye el límite de errores que evita que la app se cierre ante un fallo de pantalla.
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ApiError, type TipoError } from '../api/httpClient';
import { Boton, Icono } from './ui';
import { Resplandor } from './animacion';

interface InfoError {
  tipo: TipoError;
  titulo: string;
  mensaje: string;
  icono: string;
  tono: 'error' | 'warning' | 'info';
}

const TITULOS: Record<TipoError, { titulo: string; icono: string; tono: InfoError['tono'] }> = {
  sin_internet: { titulo: 'Sin conexión a internet', icono: 'wifi', tono: 'warning' },
  servidor_caido: { titulo: 'Servidor no disponible', icono: 'server', tono: 'error' },
  tiempo_agotado: { titulo: 'Tiempo de espera agotado', icono: 'hourglass-half', tono: 'warning' },
  sesion_vencida: { titulo: 'Tu sesión venció', icono: 'lock', tono: 'info' },
  sin_permisos: { titulo: 'Sin permisos', icono: 'ban', tono: 'error' },
  no_encontrado: { titulo: 'No encontrado', icono: 'magnifying-glass', tono: 'info' },
  validacion: { titulo: 'Revisa los datos', icono: 'pen-to-square', tono: 'warning' },
  demasiados_intentos: { titulo: 'Demasiados intentos', icono: 'gauge-high', tono: 'warning' },
  inesperado: { titulo: 'Algo salió mal', icono: 'triangle-exclamation', tono: 'error' },
};

const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Inténtalo de nuevo y, si continúa, vuelve más tarde.';

export function infoError(error: unknown): InfoError {
  const tipo: TipoError = error instanceof ApiError ? error.tipo : 'inesperado';
  // Un error de JavaScript (no del servidor) puede traer texto técnico en inglés: no se muestra.
  const mensaje = error instanceof ApiError && error.message ? error.message : MENSAJE_INESPERADO;
  return { tipo, mensaje, ...TITULOS[tipo] };
}

interface PropsEstado {
  error: unknown;
  onReintentar?: () => void;
  // Compacto: tarjeta dentro de un panel. Completo: ocupa toda la pantalla.
  compacto?: boolean;
  reintentando?: boolean;
}

export function EstadoError({ error, onReintentar, compacto = false, reintentando = false }: PropsEstado) {
  const { colors } = useTheme();
  const info = infoError(error);
  const color = info.tono === 'error' ? colors.error : info.tono === 'warning' ? colors.warning : colors.info;

  return (
    <View
      accessibilityRole="alert"
      style={[
        compacto ? estilos.compacto : estilos.completo,
        compacto && { borderColor: color + '55', backgroundColor: colors.card },
        !compacto && { backgroundColor: colors.bg },
      ]}
    >
      {!compacto && <Resplandor diametro={280} intensidad={0.6} style={estilos.resplandor} />}
      <View style={[estilos.circulo, compacto && estilos.circuloCompacto, { borderColor: color, backgroundColor: color + '1f', shadowColor: color }]}>
        <Icono name={info.icono} size={compacto ? 20 : 34} color={color} />
      </View>
      <Text style={[compacto ? estilos.tituloCompacto : estilos.titulo, { color: colors.text }]}>{info.titulo}</Text>
      <Text style={[estilos.mensaje, { color: colors.textMuted }]}>{info.mensaje}</Text>
      {onReintentar && info.tipo !== 'sesion_vencida' && info.tipo !== 'sin_permisos' && (
        <Boton titulo="Reintentar" icono="rotate-right" onPress={onReintentar} cargando={reintentando} pequeno={compacto} />
      )}
    </View>
  );
}

// Pantalla que reemplaza a la vista que falló; la app sigue abierta y se puede reintentar.
function PantallaFallo({ onReintentar }: { onReintentar: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[estilos.completo, { backgroundColor: colors.bg }]}>
      <Resplandor diametro={300} intensidad={0.7} style={estilos.resplandor} />
      <View style={[estilos.circulo, { borderColor: colors.error, backgroundColor: colors.errorSoft, shadowColor: colors.error }]}>
        <Icono name="bolt-lightning" size={34} color={colors.error} />
      </View>
      <Text style={[estilos.titulo, { color: colors.text }]}>Esta pantalla tuvo un problema</Text>
      <Text style={[estilos.mensaje, { color: colors.textMuted }]}>{MENSAJE_INESPERADO}</Text>
      <Boton titulo="Reintentar" icono="rotate-right" onPress={onReintentar} />
    </View>
  );
}

interface PropsLimite { children: ReactNode }

export class LimiteErrores extends Component<PropsLimite, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // El detalle técnico queda en la consola de Expo, nunca en pantalla.
    if (__DEV__) console.error('[app] Error de pantalla', error, info.componentStack);
  }

  reintentar = () => this.setState({ fallo: false });

  render() {
    return this.state.fallo ? <PantallaFallo onReintentar={this.reintentar} /> : this.props.children;
  }
}

// Formato que pide expo-router para el ErrorBoundary de cada ruta.
export function ErrorDeRuta({ retry }: { error: Error; retry: () => Promise<void> }) {
  return <PantallaFallo onReintentar={() => void retry()} />;
}

const estilos = StyleSheet.create({
  completo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, overflow: 'hidden' },
  compacto: { alignItems: 'center', gap: 8, padding: 18, borderRadius: 16, borderWidth: 1 },
  resplandor: { position: 'absolute', alignSelf: 'center' },
  circulo: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  circuloCompacto: { width: 48, height: 48, borderRadius: 24, shadowRadius: 10, elevation: 4 },
  titulo: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  tituloCompacto: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  mensaje: { textAlign: 'center', lineHeight: 20, maxWidth: 420 },
});
