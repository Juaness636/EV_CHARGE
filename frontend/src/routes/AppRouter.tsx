// Rutas de la SPA. Cada página nueva (mapa, dashboard, admin) se agrega aquí
// a medida que se migra desde public/*.html.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from '../context/AuthContext';
import App from '../App';
import { MapaPage } from '../features/mapa/MapaPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AdminPage } from '../features/admin/AdminPage';
import { EmpresaDashboardPage } from '../features/empresa/DashboardPage';
import { EmpresaEstacionesPage } from '../features/empresa/EstacionesPage';
import { EmpresaMapaPage } from '../features/empresa/MapaPage';
import { EmpresaIncidentesPage } from '../features/empresa/IncidentesPage';
import { EmpresaHistorialPage } from '../features/empresa/HistorialPage';
import { EmpresaEstadisticasPage } from '../features/empresa/EstadisticasPage';
import { EmpresaResenasPage } from '../features/empresa/ResenasPage';
import { EmpresaPerfilPage } from '../features/empresa/PerfilPage';

// Redirige a "/" si no hay sesión iniciada.
function RutaPrivada({ children }: { children: ReactElement }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!usuario) return <Navigate to="/" replace />;
  if (usuario.rol === 'empresa') return <Navigate to="/empresa" replace />;
  return children;
}

// Redirige a "/dashboard" si no es admin.
function RutaAdmin({ children }: { children: ReactElement }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!usuario) return <Navigate to="/" replace />;
  if (!usuario.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}

// RN-E01: el panel de empresa es exclusivo del rol `empresa`. La barrera real está en
// `/empresa/*` del backend; esto evita que un usuario común vea el panel vacío.
function RutaEmpresa({ children }: { children: ReactElement }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!usuario) return <Navigate to="/" replace />;
  if (usuario.rol !== 'empresa') return <Navigate to={usuario.is_admin ? '/admin' : '/dashboard'} replace />;
  return children;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/mapa" element={<MapaPage />} />
        <Route path="/mapa.html" element={<Navigate to="/mapa" replace />} />
        <Route
          path="/dashboard"
          element={
            <RutaPrivada>
              <DashboardPage />
            </RutaPrivada>
          }
        />
        <Route path="/dashboard_usuario.html" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/admin"
          element={
            <RutaAdmin>
              <AdminPage />
            </RutaAdmin>
          }
        />
        <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
        <Route path="/empresa" element={<RutaEmpresa><EmpresaDashboardPage /></RutaEmpresa>} />
        <Route path="/empresa/estaciones" element={<RutaEmpresa><EmpresaEstacionesPage /></RutaEmpresa>} />
        <Route path="/empresa/mapa" element={<RutaEmpresa><EmpresaMapaPage /></RutaEmpresa>} />
        <Route path="/empresa/incidentes" element={<RutaEmpresa><EmpresaIncidentesPage /></RutaEmpresa>} />
        <Route path="/empresa/historial" element={<RutaEmpresa><EmpresaHistorialPage /></RutaEmpresa>} />
        <Route path="/empresa/estadisticas" element={<RutaEmpresa><EmpresaEstadisticasPage /></RutaEmpresa>} />
        <Route path="/empresa/resenas" element={<RutaEmpresa><EmpresaResenasPage /></RutaEmpresa>} />
        <Route path="/empresa/perfil" element={<RutaEmpresa><EmpresaPerfilPage /></RutaEmpresa>} />
      </Routes>
    </BrowserRouter>
  );
}
