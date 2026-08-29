// Rutas de la SPA. Cada página nueva (mapa, dashboard, admin) se agrega aquí
// a medida que se migra desde public/*.html.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from '../context/AuthContext';
import App from '../App';
import { MapaPage } from '../features/mapa/MapaPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AdminPage } from '../features/admin/AdminPage';

// Redirige a "/" si no hay sesión iniciada.
function RutaPrivada({ children }: { children: ReactElement }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!usuario) return <Navigate to="/" replace />;
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
      </Routes>
    </BrowserRouter>
  );
}
