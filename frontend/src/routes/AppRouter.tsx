// Rutas de la SPA. Cada página nueva (mapa, dashboard, admin) se agrega aquí
// a medida que se migra desde public/*.html.
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from '../context/AuthContext';
import App from '../App';
import { MapaPage } from '../features/mapa/MapaPage';

// Placeholders: se reemplazan por el contenido real de cada página migrada.
function DashboardPage() {
  return <div>Dashboard de usuario — pendiente de migrar desde public/dashboard_usuario.html</div>;
}
function AdminPage() {
  return <div>Panel admin — pendiente de migrar desde public/admin.html</div>;
}

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
        <Route
          path="/dashboard"
          element={
            <RutaPrivada>
              <DashboardPage />
            </RutaPrivada>
          }
        />
        <Route
          path="/admin"
          element={
            <RutaAdmin>
              <AdminPage />
            </RutaAdmin>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
