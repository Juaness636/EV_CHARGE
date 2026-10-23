// Panel de administración (equivale a AdminPage.tsx del web).
import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { nombreCompleto, useAuth } from '../../context/AuthContext';
import { PanelLayout, type ItemPanel } from '../../components/PanelLayout';
import { notificar } from '../../components/Notificaciones';
import { PerfilPanel } from '../dashboard/panels/PerfilPanel';
import {
  CalificacionesAdmin, ContactosAdmin, NotificacionesAdmin, ReportesAdmin, ReservasAdmin, ResumenAdmin, UsuariosAdmin,
} from './panels/AdminPaneles';
import { EstacionesAdmin } from './panels/EstacionesAdmin';

type PanelAdmin = 'Resumen' | 'Usuarios' | 'Reportes' | 'Estaciones' | 'Reservas' | 'Notificaciones' | 'Calificaciones' | 'Contactos' | 'Perfil';

const PANELES: ItemPanel<PanelAdmin>[] = [
  { clave: 'Resumen', icono: 'chart-simple' },
  { clave: 'Usuarios', icono: 'users' },
  { clave: 'Reportes', icono: 'triangle-exclamation' },
  { clave: 'Estaciones', icono: 'charging-station' },
  { clave: 'Reservas', icono: 'calendar-check' },
  { clave: 'Notificaciones', icono: 'bell' },
  { clave: 'Calificaciones', icono: 'star-half-stroke' },
  { clave: 'Contactos', icono: 'envelope' },
  { clave: 'Perfil', icono: 'user-shield' },
];

export function AdminScreen() {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const [panel, setPanel] = useState<PanelAdmin>('Resumen');
  const [version, setVersion] = useState(0);

  const cerrarSesion = async () => {
    await logout();
    notificar({ tipo: 'success', titulo: 'Sesión cerrada', mensaje: 'Hasta pronto.' });
    router.replace('/');
  };

  return (
    <PanelLayout
      paneles={PANELES}
      activo={panel}
      onCambiar={setPanel}
      titulo={panel}
      subtitulo="Panel de administración EV Charge"
      nombreUsuario={nombreCompleto(usuario)}
      detalleUsuario="Administrador"
      onCerrarSesion={cerrarSesion}
      onRefrescar={() => setVersion((v) => v + 1)}
    >
      {panel === 'Resumen' && <ResumenAdmin version={version} />}
      {panel === 'Usuarios' && <UsuariosAdmin version={version} />}
      {panel === 'Reportes' && <ReportesAdmin version={version} />}
      {panel === 'Estaciones' && <EstacionesAdmin version={version} />}
      {panel === 'Reservas' && <ReservasAdmin version={version} />}
      {panel === 'Notificaciones' && <NotificacionesAdmin version={version} />}
      {panel === 'Calificaciones' && <CalificacionesAdmin version={version} />}
      {panel === 'Contactos' && <ContactosAdmin version={version} />}
      {panel === 'Perfil' && <PerfilPanel esAdmin />}
    </PanelLayout>
  );
}
