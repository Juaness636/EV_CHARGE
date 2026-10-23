// Panel de empresa (equivale a EmpresaLayout.tsx y las páginas /empresa/* del web).
// Solo entran cuentas con rol "empresa"; la empresa sale siempre del token en el backend.
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { PanelLayout, type ItemPanel } from '../../components/PanelLayout';
import { notificar } from '../../components/Notificaciones';
import { obtenerPerfilEmpresa, type EmpresaPerfil } from '../../api/empresa.api';
import { Aviso, EmpresaContext, etiqueta, mensajeError } from './componentes';
import { DashboardTab } from './DashboardTab';
import { EstacionesTab } from './EstacionesTab';
import { IncidentesTab } from './IncidentesTab';
import { ResenasTab } from './ResenasTab';
import { PerfilTab } from './PerfilTab';

type PanelEmpresa = 'Inicio' | 'Estaciones' | 'Incidentes' | 'Reseñas' | 'Perfil';

const PANELES: ItemPanel<PanelEmpresa>[] = [
  { clave: 'Inicio', icono: 'chart-simple' },
  { clave: 'Estaciones', icono: 'charging-station' },
  { clave: 'Incidentes', icono: 'triangle-exclamation' },
  { clave: 'Reseñas', icono: 'star-half-stroke' },
  { clave: 'Perfil', icono: 'building' },
];

const AVISO_ESTADO: Record<string, string> = {
  pendiente: 'Tu empresa está pendiente de aprobación. Puedes revisar el panel, pero no publicar ni editar estaciones.',
  suspendida: 'Tu empresa está suspendida. Tus estaciones no aparecen en el mapa; contacta al administrador.',
};

export function EmpresaScreen() {
  const { logout } = useAuth();
  const router = useRouter();
  const [perfil, setPerfil] = useState<EmpresaPerfil | null>(null);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<PanelEmpresa>('Inicio');
  // Cambiar la versión fuerza al panel activo a recargar sus datos.
  const [version, setVersion] = useState(0);

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

  const cerrarSesion = async () => {
    await logout();
    notificar({ tipo: 'success', titulo: 'Sesión cerrada', mensaje: 'Hasta pronto.' });
    router.replace('/');
  };

  const puedeOperar = perfil?.estado === 'aprobada';

  return (
    <EmpresaContext.Provider value={{ perfil, puedeOperar, refrescarPerfil }}>
      <PanelLayout
        paneles={PANELES}
        activo={panel}
        onCambiar={setPanel}
        titulo={panel}
        subtitulo={perfil ? `${perfil.nombre_comercial} · ${etiqueta(perfil.estado)}` : 'Panel de empresa'}
        nombreUsuario={perfil?.nombre_comercial || 'Empresa'}
        detalleUsuario="Empresa"
        onCerrarSesion={cerrarSesion}
        onRefrescar={() => {
          void refrescarPerfil();
          setVersion((v) => v + 1);
        }}
      >
        {error ? <Aviso tipo="error" texto={error} /> : null}
        {perfil && AVISO_ESTADO[perfil.estado] ? <Aviso tipo="info" texto={AVISO_ESTADO[perfil.estado]} /> : null}
        {panel === 'Inicio' && <DashboardTab key={version} />}
        {panel === 'Estaciones' && <EstacionesTab key={version} />}
        {panel === 'Incidentes' && <IncidentesTab key={version} />}
        {panel === 'Reseñas' && <ResenasTab key={version} />}
        {panel === 'Perfil' && perfil && <PerfilTab key={`${version}-${perfil.id}`} />}
      </PanelLayout>
    </EmpresaContext.Provider>
  );
}
