import React from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { EmpresaScreen } from './src/screens/empresa/EmpresaScreen';
import { Colors } from './src/theme/colors';

// Las cuentas de empresa ven su panel; el resto de usuarios, la pantalla principal.
function Contenido() {
  const { usuario } = useAuth();
  return usuario?.rol === 'empresa' ? <EmpresaScreen /> : <HomeScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <AuthProvider>
          <View style={styles.container}>
            <Contenido />
          </View>
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});
