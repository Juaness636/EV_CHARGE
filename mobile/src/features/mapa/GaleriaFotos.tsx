// Fotos de una estación de empresa en el detalle del mapa; al tocar una se ve en grande.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { urlMedia } from '../../api/empresa.api';
import { AppModal } from '../../components/ui';
import { useTheme } from '../../theme/ThemeContext';
import { Radius } from '../../theme/spacing';

export function GaleriaFotos({ fotos, nombre }: { fotos: string[]; nombre: string }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [abierta, setAbierta] = useState<number | null>(null);
  if (!fotos.length) return null;

  const ancho = Math.min(width - 48, 640);
  return (
    <View style={{ gap: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {fotos.map((ruta, i) => (
          <Pressable key={ruta} onPress={() => setAbierta(i)} accessibilityRole="imagebutton" accessibilityLabel={`Foto ${i + 1} de ${nombre}`}>
            <Image source={{ uri: urlMedia(ruta) }} style={styles.miniatura} contentFit="cover" transition={200} />
          </Pressable>
        ))}
      </ScrollView>
      <AppModal visible={abierta !== null} onClose={() => setAbierta(null)} titulo={nombre} anchoMaximo={680}>
        {abierta !== null ? (
          <View style={{ gap: 8 }}>
            <Image source={{ uri: urlMedia(fotos[abierta]) }} style={{ width: '100%', height: ancho * 0.66, borderRadius: Radius.md }} contentFit="contain" />
            {fotos.length > 1 ? (
              <View style={styles.navegacion}>
                <Pressable onPress={() => setAbierta((abierta + fotos.length - 1) % fotos.length)} accessibilityRole="button" accessibilityLabel="Foto anterior">
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>‹ Anterior</Text>
                </Pressable>
                <Text style={{ color: colors.textDim }}>{abierta + 1} / {fotos.length}</Text>
                <Pressable onPress={() => setAbierta((abierta + 1) % fotos.length)} accessibilityRole="button" accessibilityLabel="Foto siguiente">
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>Siguiente ›</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  miniatura: { width: 132, height: 92, borderRadius: Radius.md },
  navegacion: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
