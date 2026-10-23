// Dashboard del usuario (equivale a DashboardPage.tsx del web).
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { nombreCompleto, useAuth } from '../../context/AuthContext';
import { PanelLayout } from '../../components/PanelLayout';
import { notificar } from '../../components/Notificaciones';
import { PANELES_USUARIO, type PanelUsuario } from './tipos';
import { CargasPanel, ComprasPanel, FavoritosPanel, InicioPanel } from './panels/PanelesResumen';
import { PagosPanel, VehiculosPanel } from './panels/VehiculosPagosPaneles';
import { ReservasPanel } from './panels/ReservasPanel';
import { CalificacionesPanel, ReportesPanel } from './panels/ComunidadPaneles';
import { PerfilPanel } from './panels/PerfilPanel';

const esPanel = (valor?: string): valor is PanelUsuario => PANELES_USUARIO.some((p) => p.clave === valor);

export function DashboardScreen() {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ panel?: string }>();
  const [panel, setPanel] = useState<PanelUsuario>(esPanel(params.panel) ? params.panel : 'Inicio');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (esPanel(params.panel)) setPanel(params.panel);
  }, [params.panel]);

  const cambiar = (nuevo: PanelUsuario) => {
    setPanel(nuevo);
    router.setParams({ panel: nuevo === 'Inicio' ? undefined : nuevo });
  };

  const cerrarSesion = async () => {
    await logout();
    notificar({ tipo: 'success', titulo: 'Sesión cerrada', mensaje: 'Hasta pronto.' });
    router.replace('/');
  };

  const props = { version, irA: cambiar };

  return (
    <PanelLayout
      paneles={[...PANELES_USUARIO]}
      activo={panel}
      onCambiar={cambiar}
      titulo={panel}
      subtitulo={panel === 'Inicio' ? `Bienvenido a tu dashboard, ${usuario?.nombre ?? ''}` : 'Gestiona tu información de EV Charge'}
      nombreUsuario={nombreCompleto(usuario)}
      detalleUsuario={usuario?.email ?? ''}
      onCerrarSesion={cerrarSesion}
      onRefrescar={() => setVersion((v) => v + 1)}
    >
      {panel === 'Inicio' && <InicioPanel {...props} />}
      {panel === 'Vehículos' && <VehiculosPanel {...props} />}
      {panel === 'Reservas' && <ReservasPanel {...props} />}
      {panel === 'Pagos' && <PagosPanel {...props} />}
      {panel === 'Compras' && <ComprasPanel {...props} />}
      {panel === 'Cargas' && <CargasPanel {...props} />}
      {panel === 'Favoritos' && <FavoritosPanel {...props} />}
      {panel === 'Reportes' && <ReportesPanel {...props} />}
      {panel === 'Calificaciones' && <CalificacionesPanel {...props} />}
      {panel === 'Mi perfil' && <PerfilPanel />}
    </PanelLayout>
  );
}
