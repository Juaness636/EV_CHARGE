// Fotos de una estación en el panel de empresa: subir desde la galería y borrar.
// El backend solo acepta fotos de estaciones de la propia empresa (404 para las ajenas).
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  FOTOS_MAXIMAS_POR_ESTACION,
  FOTO_TAMANO_MAXIMO_MB,
  eliminarFotoEstacion,
  subirFotoEstacion,
  urlMedia,
  type EstacionEmpresa,
  type FotoEstacion,
} from '../../api/empresa.api';
import { Icono } from '../../components/ui';
import { Radius } from '../../theme/spacing';
import { Aviso, Boton, mensajeError, useColores, useEmpresa, useEstilos } from './componentes';

const confirmar = (mensaje: string, accion: () => void) => {
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

export const FotosEstacion: React.FC<{ estacion: EstacionEmpresa; onCambio: (e: EstacionEmpresa) => void }> = ({
  estacion,
  onCambio,
}) => {
  const estilos = useEstilos();
  const colors = useColores();
  const { puedeOperar } = useEmpresa();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const fotos = estacion.fotos || [];
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
      onCambio(await subirFotoEstacion(estacion.id, resultado.assets[0]));
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir la foto.'));
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = (foto: FotoEstacion) =>
    confirmar('¿Quitar esta foto de la estación?', () => {
      setError('');
      eliminarFotoEstacion(estacion.id, foto.id)
        .then(onCambio)
        .catch((e) => setError(mensajeError(e, 'No se pudo quitar la foto.')));
    });

  return (
    <View>
      <Text style={estilos.campoEtiqueta}>
        Fotos ({fotos.length}/{FOTOS_MAXIMAS_POR_ESTACION}) · los usuarios las ven en el mapa
      </Text>
      {error ? <Aviso tipo="error" texto={error} /> : null}
      {fotos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {fotos.map((foto) => (
            <View key={foto.id}>
              <Image source={{ uri: urlMedia(foto.url) }} style={styles.miniatura} contentFit="cover" />
              {puedeOperar ? (
                <Pressable
                  onPress={() => quitar(foto)}
                  style={[styles.quitar, { backgroundColor: colors.error }]}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                >
                  <Icono name="xmark" size={11} color="#fff" />
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={estilos.textoSuave}>Aún no hay fotos. Sube fotos de la entrada, los cargadores o la señalización.</Text>
      )}
      {puedeOperar ? (
        <View style={estilos.fila}>
          <Boton
            texto={lleno ? 'Límite de fotos alcanzado' : '+ Agregar foto'}
            deshabilitado={lleno}
            cargando={subiendo}
            onPress={() => void elegir()}
          />
          <Text style={[estilos.textoSuave, { alignSelf: 'center' }]}>JPG, PNG o WebP de máximo {FOTO_TAMANO_MAXIMO_MB} MB</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
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
