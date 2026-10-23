// Notificaciones globales (toasts), confirmaciones y aviso de notificaciones nuevas del backend.
// Equivale a components/GlobalNotifications.tsx del web: `notificar()` y `confirmar()` se pueden
// llamar desde cualquier parte de la app. Se dibujan en la capa superior (ver capas.ts).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listarNotificaciones } from '../api/notificaciones.api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { emitir, escuchar } from '../utils/eventos';
import { useEsCapaSuperior } from './capas';
import { Aparecer } from './animacion';
import { haptica } from '../utils/haptica';
import { Boton } from './ui/Boton';
import { Icono } from './ui/Icono';

export type TipoNotificacion = 'success' | 'error' | 'warning' | 'info';

export interface NotificacionVisual {
  titulo: string;
  mensaje: string;
  tipo?: TipoNotificacion;
  duracionMs?: number;
  icono?: string;
}

export interface ConfirmacionVisual {
  titulo: string;
  mensaje: string;
  confirmarTexto?: string;
  cancelarTexto?: string;
}

type Pendiente = ConfirmacionVisual & { resolver: (resultado: boolean) => void };

// Estado compartido por todas las capas.
let toastActual: (NotificacionVisual & { id: number }) | null = null;
let contadorToasts = 0;
let confirmacionActual: Pendiente | null = null;
const cola: Array<NotificacionVisual & { id: number }> = [];
const suscriptores = new Set<() => void>();
let temporizador: ReturnType<typeof setTimeout> | null = null;

const avisar = () => suscriptores.forEach((s) => s());

function mostrarSiguiente() {
  if (temporizador) clearTimeout(temporizador);
  toastActual = cola.shift() ?? null;
  if (toastActual) temporizador = setTimeout(mostrarSiguiente, toastActual.duracionMs ?? 4000);
  avisar();
}

function encolarToast(n: NotificacionVisual) {
  cola.push({ ...n, id: ++contadorToasts });
  if (!toastActual) mostrarSiguiente();
}

export function notificar(notificacion: NotificacionVisual): void {
  if (notificacion.tipo === 'success') haptica.exito();
  else if (notificacion.tipo === 'error') haptica.error();
  else if (notificacion.tipo === 'warning') haptica.aviso();
  encolarToast(notificacion);
  emitir('notificaciones-actualizadas');
}

export function confirmar(confirmacion: ConfirmacionVisual): Promise<boolean> {
  return new Promise((resolve) => {
    confirmacionActual?.resolver(false);
    confirmacionActual = { ...confirmacion, resolver: resolve };
    haptica.aviso();
    avisar();
  });
}

function responder(resultado: boolean) {
  confirmacionActual?.resolver(resultado);
  confirmacionActual = null;
  avisar();
}

export const iconoNotificacion = (tipo?: string): string => ({
  vehiculo: 'car',
  reserva: 'calendar-check',
  compra: 'bag-shopping',
  pago: 'credit-card',
  reporte: 'triangle-exclamation',
  favorito: 'star',
  calificacion: 'star-half-stroke',
  sistema: 'bolt',
  error: 'circle-xmark',
  warning: 'triangle-exclamation',
  success: 'circle-check',
}[tipo || ''] || 'bell');

// Dibuja el toast y la confirmación si esta capa es la superior.
export function CapaNotificaciones({ capa }: { capa: string }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const esSuperior = useEsCapaSuperior(capa);
  const [, forzar] = useState(0);

  useEffect(() => {
    const actualizar = () => forzar((n) => n + 1);
    suscriptores.add(actualizar);
    return () => {
      suscriptores.delete(actualizar);
    };
  }, []);

  if (!esSuperior || (!toastActual && !confirmacionActual)) return null;
  const toast = toastActual;
  const confirmacion = confirmacionActual;
  const tipo = toast?.tipo ?? 'info';
  const color = tipo === 'error' ? colors.error : tipo === 'warning' ? colors.warning : tipo === 'success' ? colors.primary : colors.info;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.capa]}>
      {confirmacion && (
        <View style={[StyleSheet.absoluteFill, styles.confirmFondo, { backgroundColor: colors.overlay }]}>
          <Aparecer desde="escala" duracion={260} style={{ width: '100%', maxWidth: 420 }}>
          <View accessibilityRole="alert" style={[styles.confirmTarjeta, { backgroundColor: colors.card, borderColor: colors.warning }]}>
            <View style={styles.fila}>
              <View style={[styles.icono, { backgroundColor: colors.warningSoft }]}>
                <Icono name="triangle-exclamation" size={14} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.titulo, { color: colors.warning }]}>{confirmacion.titulo}</Text>
                <Text style={[styles.mensaje, { color: colors.textMuted }]}>{confirmacion.mensaje}</Text>
              </View>
            </View>
            <View style={styles.acciones}>
              <Boton titulo={confirmacion.cancelarTexto || 'Cancelar'} variante="outline" pequeno onPress={() => responder(false)} />
              <Boton titulo={confirmacion.confirmarTexto || 'Confirmar'} variante="danger" pequeno onPress={() => responder(true)} />
            </View>
          </View>
          </Aparecer>
        </View>
      )}
      {toast && (
        <View pointerEvents="box-none" style={[styles.toastContenedor, { top: insets.top + 10 }]}>
          <Aparecer key={toast.id} desde="arriba" duracion={320} style={{ width: '100%', alignItems: 'center' }}>
          <View accessibilityRole="alert" style={[styles.toast, { borderColor: color, backgroundColor: colors.modo === 'dark' ? 'rgba(20,20,20,0.97)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={[styles.icono, { backgroundColor: color + '22' }]}>
              <Icono name={toast.icono ?? iconoNotificacion(tipo)} size={14} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.titulo, { color }]}>{toast.titulo}</Text>
              <Text style={[styles.mensaje, { color: colors.text }]}>{toast.mensaje}</Text>
            </View>
            <Pressable onPress={mostrarSiguiente} hitSlop={10} accessibilityLabel="Cerrar notificación">
              <Icono name="xmark" size={14} color={colors.textDim} />
            </Pressable>
          </View>
          </Aparecer>
        </View>
      )}
    </View>
  );
}

// Capa raíz + consulta periódica de notificaciones nuevas del backend.
export function NotificacionesHost() {
  const { usuario } = useAuth();
  const idsConocidos = useRef<Set<string>>(new Set());
  const primeraConsulta = useRef(true);

  useEffect(() => {
    idsConocidos.current = new Set();
    primeraConsulta.current = true;
    if (!usuario) return;
    let cancelado = false;
    const consultar = async () => {
      try {
        const lista = await listarNotificaciones();
        if (cancelado) return;
        const nuevas = lista.filter((item) => !idsConocidos.current.has(item.id));
        lista.forEach((item) => idsConocidos.current.add(item.id));
        if (primeraConsulta.current) {
          primeraConsulta.current = false;
          return;
        }
        nuevas.slice(0, 3).forEach((item) => encolarToast({ titulo: item.titulo, mensaje: item.mensaje, tipo: 'info', icono: iconoNotificacion(item.tipo) }));
      } catch {
        // No interrumpir la navegación si el historial no está disponible.
      }
    };
    void consultar();
    const intervalo = setInterval(() => void consultar(), 30000);
    const quitar = escuchar('notificaciones-actualizadas', () => void consultar());
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      quitar();
    };
  }, [usuario]);

  return <CapaNotificaciones capa="raiz" />;
}

const styles = StyleSheet.create({
  capa: { zIndex: 1000, elevation: 30 },
  toastContenedor: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 14 },
  toast: {
    width: '100%', maxWidth: 380, flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14,
    borderRadius: Radius.md, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  icono: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontWeight: '800', fontSize: 14 },
  mensaje: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  confirmFondo: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  confirmTarjeta: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 12, borderWidth: 1 },
  fila: { flexDirection: 'row', gap: 10 },
  acciones: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
});
