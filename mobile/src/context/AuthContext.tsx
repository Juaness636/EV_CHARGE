// Contexto global de autenticación para React Native
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { obtenerPerfil, login as loginApi, registro as registroApi, logout as logoutApi } from '../api/auth.api';
import type { Usuario } from '../types';

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, pass: string) => Promise<void>;
  registro: (nombre: string, apellido: string, email: string, pass: string) => Promise<void>;
  actualizarUsuario: (usuario: Usuario) => void;
  logout: () => Promise<void>;
  recargarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarSesion = async () => {
    try {
      const token = await AsyncStorage.getItem('ev_token');
      if (!token) {
        setUsuario(null);
        setCargando(false);
        return;
      }
      const data = await obtenerPerfil();
      setUsuario(data.usuario);
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarSesion();
  }, []);

  const login = async (email: string, pass: string) => {
    const data = await loginApi(email, pass);
    setUsuario(data.usuario);
  };

  const registro = async (nombre: string, apellido: string, email: string, pass: string) => {
    const data = await registroApi(nombre, apellido, email, pass);
    if (data.access_token) {
      setUsuario(data.usuario);
    }
  };

  const logout = async () => {
    await logoutApi();
    setUsuario(null);
  };

  const actualizarUsuario = (usuarioActualizado: Usuario) => {
    setUsuario(usuarioActualizado);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        cargando,
        login,
        registro,
        actualizarUsuario,
        logout,
        recargarPerfil: cargarSesion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un <AuthProvider>');
  }
  return context;
}
