// Fotos de una estación con botones para subir (desde la galería) y quitar.
// Lo usan el panel de empresa (sus estaciones) y el admin (cualquier estación); quién puede
// tocar qué estación lo decide siempre el backend.
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  FOTOS_MAXIMAS_POR_ESTACION,
  FOTO_TAMANO_MAXIMO_MB,
  urlMedia,
  type FotoElegida,
  type FotoEstacion,
} from '../api/empresa.api';
import { mensajeError } from '../api/httpClient';
import { useTheme } from '../theme/ThemeContext';
import { Radius } from '../theme/spacing';
import { Alerta, Boton, Icono } from './ui';

const confirmarQuitar = (accion: () => void) => {
  const mensaje = '¿Quitar esta foto de la estación?';
  // Alert con botones no existe en react-native-web.
  if (Platform.OS === 'web') {
    if (window.confirm(mensaje)) accion();
    return;
  }
  Alert.alert('Quitar foto', mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Quitar', style: 'destructive', onPress: accion },
  ]);
};

interface Props {
  fotos: FotoEstacion[];
  puedeEditar: boolean;
  onSubir: (foto: FotoElegida) => Promise<unknown>;
  onQuitar: (foto: FotoEstacion) => Promise<unknown>;
}

export function EditorFotos({ fotos, puedeEditar, onSubir, onQuitar }: Props) {
  const { colors } = useTheme();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const lleno = fotos.length >= FOTOS_MAXIMAS_POR_ESTACION;

  const elegir = async () => {
    setError('');
    if (Platform.OS !== 'web') {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) return setError('Necesitamos permiso para acceder a tus fotos.');
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (resultado.canceled || !resultado.assets?.length) return;
    setSubiendo(true);
    try {
      await onSubir(resultado.assets[0]);
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir la foto.'));
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = (foto: FotoEstacion) =>
    confirmarQuitar(() => {
      setError('');
      onQuitar(foto).catch((e) => setError(mensajeError(e, 'No se pudo quitar la foto.')));
    });

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.etiqueta, { color: colors.text }]}>
        Fotos ({fotos.length}/{FOTOS_MAXIMAS_POR_ESTACION}) · los usuarios las ven en el mapa
      </Text>
      {error ? <Alerta texto={error} /> : null}
      {fotos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {fotos.map((foto) => (
            <View key={foto.id}>
              <Image source={{ uri: urlMedia(foto.url) }} style={styles.miniatura} contentFit="cover" />
              {puedeEditar ? (
                <Pressable
                  onPress={() => quitar(foto)}
                  style={[styles.quitar, { backgroundColor: colors.error }]}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  hitSlop={8}
                >
                  <Icono name="xmark" size={11} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          Aún no hay fotos. Sube fotos de la entrada, los cargadores o la señalización.
        </Text>
      )}
      {puedeEditar ? (
        <View style={{ gap: 4 }}>
          <Boton
            titulo={lleno ? 'Límite de fotos alcanzado' : 'Agregar foto'}
            icono="camera"
            variante="soft"
            pequeno
            disabled={lleno}
            cargando={subiendo}
            onPress={() => void elegir()}
            style={{ alignSelf: 'flex-start' }}
          />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>JPG, PNG o WebP de máximo {FOTO_TAMANO_MAXIMO_MB} MB</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: { fontSize: 13, fontWeight: '700' },
  miniatura: { width: 110, height: 80, borderRadius: Radius.md },
  quitar: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
