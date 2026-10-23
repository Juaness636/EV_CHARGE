// Rutas de la SPA. Cada página nueva (mapa, dashboard, admin) se agrega aquí
// a medida que se migra desde public/*.html.
import { lazy, Suspense, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import App from '../App';
import { GlobalNotifications } from '../components/GlobalNotifications';
import { AsistenteChat } from '../components/AsistenteChat';

const MapaPage = lazy(() => import('../features/mapa/MapaPage').then(({ MapaPage }) => ({ default: MapaPage })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then(({ DashboardPage }) => ({ default: DashboardPage })));
const AdminPage = lazy(() => import('../features/admin/AdminPage').then(({ AdminPage }) => ({ default: AdminPage })));
const EmpresaDashboardPage = lazy(() => import('../features/empresa/DashboardPage').then(({ EmpresaDashboardPage }) => ({ default: EmpresaDashboardPage })));
const EmpresaEstacionesPage = lazy(() => import('../features/empresa/EstacionesPage').then(({ EmpresaEstacionesPage }) => ({ default: EmpresaEstacionesPage })));
const EmpresaMapaPage = lazy(() => import('../features/empresa/MapaPage').then(({ EmpresaMapaPage }) => ({ default: EmpresaMapaPage })));
const EmpresaIncidentesPage = lazy(() => import('../features/empresa/IncidentesPage').then(({ EmpresaIncidentesPage }) => ({ default: EmpresaIncidentesPage })));
const EmpresaHistorialPage = lazy(() => import('../features/empresa/HistorialPage').then(({ EmpresaHistorialPage }) => ({ default: EmpresaHistorialPage })));
const EmpresaEstadisticasPage = lazy(() => import('../features/empresa/EstadisticasPage').then(({ EmpresaEstadisticasPage }) => ({ default: EmpresaEstadisticasPage })));
const EmpresaResenasPage = lazy(() => import('../features/empresa/ResenasPage').then(({ EmpresaResenasPage }) => ({ default: EmpresaResenasPage })));
const EmpresaPerfilPage = lazy(() => import('../features/empresa/PerfilPage').then(({ EmpresaPerfilPage }) => ({ default: EmpresaPerfilPage })));
const ProductosPage = lazy(() => import('../features/productos/ProductosPage').then(({ ProductosPage }) => ({ default: ProductosPage })));

// Redirige a "/" si no hay sesión iniciada.
function RutaPrivada({ children }: { children: ReactElement }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!usuario) return <Navigate to="/" replace />;
  if (usuario.is_admin) return <Navigate to="/admin" replace />;
  if (usuario.rol === 'empresa') return <Navigate to="/empresa" replace />;
  return children;
}

// Redirige a "/dashboard" si no es admin.
function RutaAdmin({ children }: { children: ReactElement }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  if (!usuario) return <Navigate to="/" replace />;
  if (!usuario.is_admin) return <Navigate to={usuario.rol === 'empresa' ? '/empresa' : '/dashboard'} replace />;
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
      <Suspense fallback={<div className="page-loading">Cargando página...</div>}>
        <GlobalNotifications />
        <AsistenteChat />
        <Routes>
        <Route path="/" element={<App />} />
        <Route path="/mapa" element={<MapaPage />} />
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/mapa.html" element={<Navigate to="/mapa" replace />} />
        <Route
          path="/dashboard"
          element={
            <RutaPrivada>
              <DashboardPage />
            </RutaPrivada>
          }
        />
        <Route
          path="/dashboard_usuario.html"
          element={
            <RutaPrivada>
              <Navigate to="/dashboard" replace />
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
      </Suspense>
    </BrowserRouter>
  );
}
