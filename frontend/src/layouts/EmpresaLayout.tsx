// Shell del panel de empresa: mismo esqueleto y clases del panel de admin
// (`dashboard-shell` + `#admin-sidebar`), con el perfil de la empresa en contexto
// para que las páginas gateen escrituras sin repetir la llamada (RN-E11).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import '../styles/admin.css';
import { useAuth } from '../context/AuthContext';
import { obtenerPerfilEmpresa, type EmpresaPerfil } from '../api/empresa.api';

const secciones = [
  { to: '/empresa', label: 'Dashboard', end: true },
  { to: '/empresa/estaciones', label: 'Estaciones', end: false },
  { to: '/empresa/mapa', label: 'Mapa', end: false },
  { to: '/empresa/incidentes', label: 'Incidentes', end: false },
  { to: '/empresa/historial', label: 'Historial', end: false },
  { to: '/empresa/estadisticas', label: 'Estadisticas', end: false },
  { to: '/empresa/resenas', label: 'Resenas', end: false },
  { to: '/empresa/perfil', label: 'Perfil', end: false },
];

interface EmpresaContexto {
  perfil: EmpresaPerfil | null;
  error: string;
  refrescar: () => Promise<void>;
  puedeOperar: boolean;
}

const Contexto = createContext<EmpresaContexto>({ perfil: null, error: '', refrescar: async () => {}, puedeOperar: false });

export function useEmpresa() {
  return useContext(Contexto);
}

export function EmpresaLayout({ children, titulo }: { children: ReactNode; titulo: string }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<EmpresaPerfil | null>(null);
  const [error, setError] = useState('');

  const refrescar = async () => {
    try {
      setPerfil(await obtenerPerfilEmpresa());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el perfil de la empresa.');
    }
  };

  useEffect(() => { void refrescar(); }, []);

  const puedeOperar = perfil?.estado === 'aprobada';

  return (
    <div className="dashboard-shell">
      <aside id="admin-sidebar">
        <div className="admin-brand">
          {perfil ? (
            <>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: perfil.color_hex, flexShrink: 0 }} />
              <span>{perfil.nombre_comercial}</span>
            </>
          ) : (
            <>
              <img src="/img/logo.png" alt="EV Charge" />
              <span>EV Charge</span>
            </>
          )}
        </div>
        <div className="admin-user-info-sidebar">
          <strong>{usuario?.nombre} {usuario?.apellido}</strong>
          <small>{perfil ? `Empresa · ${perfil.estado}` : 'Empresa'}</small>
        </div>
        <nav className="admin-nav">
          {secciones.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `anav${isActive ? ' active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-nav-bottom">
          <Link className="anav" to="/mapa">Mapa publico</Link>
          <button className="anav danger" onClick={() => { logout(); navigate('/'); }}>Cerrar sesion</button>
        </div>
      </aside>

      <main id="admin-content">
        <header id="admin-header">
          <div>
            <h1>{titulo}</h1>
            <p>Panel de empresa EV Charge</p>
          </div>
        </header>
        <section className="panel active">
          {error && <div className="alert alert-error">{error}</div>}
          {!puedeOperar && perfil && (
            <div className="alert alert-error">
              Tu empresa esta en estado <strong>{perfil.estado}</strong>. Puedes consultar la informacion,
              pero no crear ni modificar estaciones hasta que un administrador la apruebe o reactive.
            </div>
          )}
          <Contexto.Provider value={{ perfil, error, refrescar, puedeOperar }}>{children}</Contexto.Provider>
        </section>
      </main>
    </div>
  );
}
