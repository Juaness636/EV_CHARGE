// Layout raíz: proveedores globales (tema, sesión, UI), navegación y elementos flotantes
// (modal de autenticación, notificaciones y asistente IA), como AppRouter.tsx del web.
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { UIProvider } from '../src/context/UIContext';
import { AuthModal } from '../src/components/AuthModal';
import { NotificacionesHost } from '../src/components/Notificaciones';
import { AsistenteChat } from '../src/components/AsistenteChat';
import { SplashAnimado } from '../src/components/animacion';

// La pantalla nativa de arranque (logo sobre fondo oscuro) se mantiene hasta que React
// pinta la primera vista; luego la reemplaza el splash animado.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Contenido() {
  const { colors } = useTheme();
  const { cargando } = useAuth();
  const [mostrarSplash, setMostrarSplash] = useState(true);
  const terminarSplash = useCallback(() => setMostrarSplash(false), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={() => SplashScreen.hideAsync().catch(() => undefined)}>
      <StatusBar style={mostrarSplash || colors.modo === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade_from_bottom',
          animationDuration: 280,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'EV Charge' }} />
        <Stack.Screen name="mapa" options={{ title: 'Mapa · EV Charge' }} />
        <Stack.Screen name="productos" options={{ title: 'Productos · EV Charge' }} />
        <Stack.Screen name="dashboard" options={{ title: 'Mi dashboard · EV Charge' }} />
        <Stack.Screen name="admin" options={{ title: 'Administración · EV Charge' }} />
      </Stack>
      <AsistenteChat />
      <AuthModal />
      <NotificacionesHost />
      {mostrarSplash && <SplashAnimado listo={!cargando} onTerminar={terminarSplash} />}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <UIProvider>
            <Contenido />
          </UIProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
