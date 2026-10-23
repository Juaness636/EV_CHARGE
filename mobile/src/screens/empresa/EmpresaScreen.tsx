// Panel de empresa móvil. Se muestra en lugar del HomeScreen cuando el usuario tiene rol "empresa".
// No hay librería de navegación en la app: las secciones se cambian con un estado de pestaña.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/spacing';
import { obtenerPerfilEmpresa, type EmpresaPerfil } from '../../api/empresa.api';
import { Aviso, Boton, EmpresaContext, mensajeError } from './componentes';
import { DashboardTab } from './DashboardTab';
import { EstacionesTab } from './EstacionesTab';
import { IncidentesTab } from './IncidentesTab';
import { ResenasTab } from './ResenasTab';
import { PerfilTab } from './PerfilTab';

type Pestana = 'dashboard' | 'estaciones' | 'incidentes' | 'resenas' | 'perfil';

const PESTANAS: Array<{ valor: Pestana; texto: string }> = [
  { valor: 'dashboard', texto: 'Inicio' },
  { valor: 'estaciones', texto: 'Estaciones' },
  { valor: 'incidentes', texto: 'Incidentes' },
  { valor: 'resenas', texto: 'Reseñas' },
  { valor: 'perfil', texto: 'Perfil' },
];

const AVISO_ESTADO: Record<string, string> = {
  pendiente: 'Tu empresa está pendiente de aprobación. Puedes revisar el panel, pero no publicar ni editar estaciones.',
  suspendida: 'Tu empresa está suspendida. Tus estaciones no aparecen en el mapa; contacta al administrador.',
};

export const EmpresaScreen: React.FC = () => {
  const { logout } = useAuth();
  const [perfil, setPerfil] = useState<EmpresaPerfil | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('dashboard');
  // Cambiar la clave fuerza a la pestaña a recargar sus datos (pull-to-refresh).
  const [recarga, setRecarga] = useState(0);
  const [refrescando, setRefrescando] = useState(false);

  const refrescarPerfil = useCallback(async () => {
    try {
      setPerfil(await obtenerPerfilEmpresa());
      setError('');
    } catch (e) {
      setError(mensajeError(e, 'No se pudo cargar el perfil de la empresa.'));
    }
  }, []);

  useEffect(() => {
    void refrescarPerfil();
  }, [refrescarPerfil]);

  const onRefresh = async () => {
    setRefrescando(true);
    await refrescarPerfil();
    setRecarga((n) => n + 1);
    setRefrescando(false);
  };

  if (!perfil && !error) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={Colors.greenEv} />
      </View>
    );
  }

  const color = perfil?.color_hex || Colors.greenEv;
  const puedeOperar = perfil?.estado === 'aprobada';

  return (
    <EmpresaContext.Provider value={{ perfil, puedeOperar, refrescarPerfil }}>
      <View style={styles.contenedor}>
        <View style={[styles.cabecera, { borderBottomColor: color }]}>
          <View style={styles.marca}>
            <View style={[styles.punto, { backgroundColor: color }]} />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.nombre} numberOfLines={1}>{perfil?.nombre_comercial || 'Empresa'}</Text>
              <Text style={styles.subtitulo}>Panel de empresa</Text>
            </View>
          </View>
          <Boton texto="Salir" onPress={() => void logout()} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pestanas} contentContainerStyle={styles.pestanasContenido}>
          {PESTANAS.map((p) => (
            <TouchableOpacity
              key={p.valor}
              onPress={() => setPestana(p.valor)}
              style={[styles.pestana, pestana === p.valor && { backgroundColor: color, borderColor: color }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.pestanaTexto, pestana === p.valor && { color: Colors.white }]}>{p.texto}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          contentContainerStyle={styles.cuerpo}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={Colors.greenEv} />}
        >
          {error ? <Aviso tipo="error" texto={error} /> : null}
          {perfil && AVISO_ESTADO[perfil.estado] ? <Aviso tipo="info" texto={AVISO_ESTADO[perfil.estado]} /> : null}
          {pestana === 'dashboard' && <DashboardTab key={recarga} />}
          {pestana === 'estaciones' && <EstacionesTab key={recarga} />}
          {pestana === 'incidentes' && <IncidentesTab key={recarga} />}
          {pestana === 'resenas' && <ResenasTab key={recarga} />}
          {pestana === 'perfil' && <PerfilTab key={recarga} />}
        </ScrollView>
      </View>
    </EmpresaContext.Provider>
  );
};

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: Colors.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 2,
    gap: Spacing.sm,
  },
  marca: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  punto: { width: 14, height: 14, borderRadius: Radius.full },
  nombre: { color: Colors.white, fontSize: 17, fontWeight: '900' },
  subtitulo: { color: Colors.textMuted, fontSize: 12 },
  pestanas: { flexGrow: 0 },
  pestanasContenido: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 6 },
  pestana: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pestanaTexto: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  cuerpo: { padding: Spacing.md, paddingBottom: Spacing.xxl },
});
