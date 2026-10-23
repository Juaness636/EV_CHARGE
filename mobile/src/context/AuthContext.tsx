// Estado global de sesión: usuario autenticado + token persistido en AsyncStorage.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { obtenerPerfil, login as loginApi, logout as logoutApi, type Usuario } from '../api/auth.api';
import { obtenerToken, onSesionExpirada } from '../api/httpClient';

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  actualizarUsuario: (usuario: Usuario) => void;
  recargarPerfil: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargarPerfil = useCallback(async () => {
    const token = await obtenerToken();
    if (!token) {
      setUsuario(null);
      return;
    }
    try {
      const data = await obtenerPerfil();
      setUsuario(data.usuario);
    } catch {
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    recargarPerfil().finally(() => setCargando(false));
    return onSesionExpirada(() => setUsuario(null));
  }, [recargarPerfil]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await loginApi(email, password);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUsuario(null);
  }, []);

  const value = useMemo(
    () => ({ usuario, cargando, login, actualizarUsuario: setUsuario, recargarPerfil, logout }),
    [usuario, cargando, login, recargarPerfil, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

// Panel de cada tipo de cuenta, como el redireccionamiento por rol del login web.
export type RolPanel = 'usuario' | 'admin' | 'empresa';

export function rolDe(usuario: Pick<Usuario, 'is_admin' | 'rol'>): RolPanel {
  if (usuario.is_admin) return 'admin';
  return usuario.rol === 'empresa' ? 'empresa' : 'usuario';
}

export const RUTA_PANEL: Record<RolPanel, '/admin' | '/empresa' | '/dashboard'> = {
  admin: '/admin',
  empresa: '/empresa',
  usuario: '/dashboard',
};

export const rutaPanel = (usuario: Pick<Usuario, 'is_admin' | 'rol'>) => RUTA_PANEL[rolDe(usuario)];

export function nombreCompleto(usuario?: Pick<Usuario, 'nombre' | 'apellido'> | null): string {
  if (!usuario) return '';
  return usuario.apellido ? `${usuario.nombre} ${usuario.apellido}` : usuario.nombre;
}
