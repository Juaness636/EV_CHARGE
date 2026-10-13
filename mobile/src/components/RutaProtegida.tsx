// Protege /dashboard y /admin, igual que RutaPrivada y RutaAdmin del AppRouter web.
import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { LogoCargando } from './animacion';

export function RutaProtegida({ rol, children }: { rol: 'usuario' | 'admin'; children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  const { colors } = useTheme();

  if (cargando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <LogoCargando tamano={64} />
        <Text style={{ color: colors.textDim, marginTop: 14 }}>Verificando tu sesión…</Text>
      </View>
    );
  }
  if (!usuario) return <Redirect href="/" />;
  if (rol === 'usuario' && usuario.is_admin) return <Redirect href="/admin" />;
  if (rol === 'admin' && !usuario.is_admin) return <Redirect href="/dashboard" />;
  return <>{children}</>;
}
