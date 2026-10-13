// Estado de interfaz compartido: el modal de autenticación se puede abrir
// desde cualquier pantalla (landing, mapa, productos), igual que en el web.
import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AuthTab = 'login' | 'registro' | 'recuperar';

interface UIContextValue {
  authVisible: boolean;
  authTab: AuthTab;
  authMensaje: string | null;
  abrirAuth: (tab?: AuthTab, mensaje?: string) => void;
  cerrarAuth: () => void;
  setAuthTab: (tab: AuthTab) => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [authVisible, setAuthVisible] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [authMensaje, setAuthMensaje] = useState<string | null>(null);

  const abrirAuth = useCallback((tab: AuthTab = 'login', mensaje?: string) => {
    setAuthTab(tab);
    setAuthMensaje(mensaje ?? null);
    setAuthVisible(true);
  }, []);

  const cerrarAuth = useCallback(() => {
    setAuthVisible(false);
    setAuthMensaje(null);
  }, []);

  const value = useMemo(
    () => ({ authVisible, authTab, authMensaje, abrirAuth, cerrarAuth, setAuthTab }),
    [authVisible, authTab, authMensaje, abrirAuth, cerrarAuth],
  );
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI debe usarse dentro de <UIProvider>');
  return ctx;
}
