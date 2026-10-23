// Protege /dashboard, /admin y /empresa, igual que RutaPrivada, RutaAdmin y RutaEmpresa del AppRouter web.
import React, { type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { RUTA_PANEL, rolDe, useAuth, type RolPanel } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { LogoCargando } from './animacion';

export function RutaProtegida({ rol, children }: { rol: RolPanel; children: ReactNode }) {
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
  // Cada cuenta solo entra a su propio panel; si abre otro, se le lleva al suyo.
  const propio = rolDe(usuario);
  if (propio !== rol) return <Redirect href={RUTA_PANEL[propio]} />;
  return <>{children}</>;
}
