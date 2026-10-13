// Tema global: oscuro, claro o del sistema (igual al widget flotante del web).
// La preferencia se guarda en AsyncStorage con la misma clave del web (ev_theme).
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkPalette, lightPalette, type Palette } from './colors';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  colors: Palette;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const CLAVE_TEMA = 'ev_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const sistema = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_TEMA)
      .then((valor) => {
        if (valor === 'dark' || valor === 'light' || valor === 'system') setModeState(valor);
      })
      .catch(() => undefined);
  }, []);

  const setMode = (nuevo: ThemeMode) => {
    setModeState(nuevo);
    AsyncStorage.setItem(CLAVE_TEMA, nuevo).catch(() => undefined);
  };

  const efectivo = mode === 'system' ? (sistema === 'light' ? 'light' : 'dark') : mode;
  const value = useMemo(
    () => ({ colors: efectivo === 'light' ? lightPalette : darkPalette, mode, setMode }),
    [efectivo, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}

// Crea estilos dependientes del tema y los memoriza mientras la paleta no cambie.
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
