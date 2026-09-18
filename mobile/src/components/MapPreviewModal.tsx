// Modal con Mapa Nativo Interactivo usando react-native-maps (equivalente a Leaflet en web)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Callout, UrlTile } from 'react-native-maps';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Spacing, Radius } from '../theme/spacing';
import { listarEstacionesBogota, type EstacionAPI } from '../api/mapa.api';

interface MapModalProps {
  visible: boolean;
  onClose: () => void;
}

// Estaciones de respaldo en Bogotá en caso de que el backend no esté ejecutándose aún
const ESTACIONES_DEMO: EstacionAPI[] = [
  {
    id: '1',
    nombre: 'Estación EV Corferias',
    direccion: 'Carrera 37 # 24-67, Bogotá',
    lat: 4.6293,
    lon: -74.0901,
    estado: 'operativa',
    puntos_carga: 4,
    conectores: ['CCS2', 'Tipo 2'],
  },
  {
    id: '2',
    nombre: 'Carga Rápida Centro Mayor',
    direccion: 'Calle 38A Sur # 34D-51, Bogotá',
    lat: 4.5912,
    lon: -74.1235,
    estado: 'operativa',
    puntos_carga: 2,
    conectores: ['CCS2', 'CHAdeMO'],
  },
  {
    id: '3',
    nombre: 'Estación Unicentro Norte',
    direccion: 'Avenida Carrera 15 # 124-30, Bogotá',
    lat: 4.7018,
    lon: -74.0415,
    estado: 'reservada',
    puntos_carga: 6,
    conectores: ['Tipo 2', 'CCS2'],
  },
  {
    id: '4',
    nombre: 'Estación Parque Simón Bolívar',
    direccion: 'Calle 63 y Carrera 60, Bogotá',
    lat: 4.6582,
    lon: -74.0938,
    estado: 'operativa',
    puntos_carga: 3,
    conectores: ['Tipo 2'],
  },
  {
    id: '5',
    nombre: 'Estación Salitre Plaza',
    direccion: 'Carrera 68B # 24-39, Bogotá',
    lat: 4.6515,
    lon: -74.1165,
    estado: 'mantenimiento',
    puntos_carga: 2,
    conectores: ['CCS2'],
  },
];

export const MapPreviewModal: React.FC<MapModalProps> = ({ visible, onClose }) => {
  const [estaciones, setEstaciones] = useState<EstacionAPI[]>(ESTACIONES_DEMO);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState<'TODAS' | 'operativa' | 'reservada' | 'mantenimiento'>('TODAS');

  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    const fetchEstaciones = async () => {
      setCargando(true);
      try {
        const data = await listarEstacionesBogota();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setEstaciones(data);
        }
      } catch {
        // Mantiene estaciones DEMO si no hay conexión
      } finally {
        if (isMounted) setCargando(false);
      }
    };

    void fetchEstaciones();
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const getColorPorEstado = (estado?: string) => {
    switch (estado) {
      case 'mantenimiento':
        return Colors.warning;
      case 'inactiva':
        return Colors.error;
      case 'reservada':
        return Colors.info;
      default:
        return Colors.success;
    }
  };

  const estacionesFiltradas = estaciones.filter((est) => {
    if (filtro === 'TODAS') return true;
    return est.estado === filtro;
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header del Mapa */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mapa de Estaciones</Text>
            <Text style={styles.headerSubtitle}>Bogotá D.C. · react-native-maps</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <FontAwesome6 name="xmark" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {/* Barra de Filtros */}
        <View style={styles.filtersBar}>
          {(['TODAS', 'operativa', 'reservada', 'mantenimiento'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filtro === f && styles.filterChipActive]}
              onPress={() => setFiltro(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filtro === f && styles.filterChipTextActive,
                ]}
              >
                {f === 'TODAS'
                  ? 'Todas'
                  : f === 'operativa'
                  ? 'Disponibles'
                  : f === 'reservada'
                  ? 'Reservadas'
                  : 'Mantenimiento'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Componente Nativo MapView */}
        <View style={styles.mapWrapper}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: 4.6651,
              longitude: -74.1204,
              latitudeDelta: 0.16,
              longitudeDelta: 0.16,
            }}
          >
            <UrlTile
              // Proveedor CartoDB Voyager: estilo idéntico a OSM pero optimizado para móviles
              urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
              maximumZ={19}
              zIndex={1}
            />
            {estacionesFiltradas.map((est) => {
              // 1. Escudo de seguridad: ignora la estación si el backend no envía coordenadas
              if (!est.lat || !est.lon) return null;

              const markerColor = getColorPorEstado(est.estado);
              return (
                <Marker
                  key={String(est.id)}
                  coordinate={{
                    // 2. Forzado de tipo: convierte cualquier string a decimal nativo
                    latitude: Number(est.lat),
                    longitude: Number(est.lon),
                  }}
                  pinColor={markerColor}
                >
                  <Callout style={styles.callout}>
                    <Text style={styles.calloutTitle}>{est.nombre}</Text>
                    {est.direccion && (
                      <Text style={styles.calloutDesc}>{est.direccion}</Text>
                    )}
                    <Text style={[styles.calloutState, { color: markerColor }]}>
                      Estado: {est.estado || 'Operativa'}
                    </Text>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>

          {cargando && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.greenEv} />
            </View>
          )}
        </View>

        {/* Resumen inferior */}
        <View style={styles.footer}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: Colors.success }]} />
              <Text style={styles.legendText}>Disponible</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: Colors.info }]} />
              <Text style={styles.legendText}>Reservada</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
              <Text style={styles.legendText}>Mantenimiento</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    backgroundColor: Colors.bgCard,
    paddingTop: 45,
    paddingBottom: 14,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: Colors.greenEv,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  filtersBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bg2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: 8,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.greenEv,
    borderColor: Colors.greenEv,
  },
  filterChipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  mapWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callout: {
    width: 180,
    padding: 6,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
  },
  calloutDesc: {
    fontSize: 11,
    color: '#444',
    marginTop: 2,
  },
  calloutState: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  footer: {
    backgroundColor: Colors.bgCard,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
});