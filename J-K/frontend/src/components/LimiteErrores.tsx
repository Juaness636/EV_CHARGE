// Límite de errores: si una pantalla falla al dibujarse, muestra un aviso con "Reintentar"
// en lugar de dejar la página en blanco.
import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }

export class LimiteErrores extends Component<Props, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // El detalle técnico queda en la consola del navegador, nunca en pantalla.
    console.error('[app] Error de pantalla', error, info.componentStack);
  }

  render() {
    if (!this.state.fallo) return this.props.children;
    return (
      <div role="alert" style={estilos.contenedor}>
        <div style={estilos.circulo}><i className="fa-solid fa-bolt-lightning" style={{ fontSize: 32, color: 'var(--red)' }} /></div>
        <h2 style={estilos.titulo}>Esta pantalla tuvo un problema</h2>
        <p style={estilos.mensaje}>Ocurrió un error inesperado. Inténtalo de nuevo y, si continúa, vuelve más tarde.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button type="button" style={estilos.boton} onClick={() => this.setState({ fallo: false })}>
            <i className="fa-solid fa-rotate-right" /> Reintentar
          </button>
          <button type="button" style={{ ...estilos.boton, ...estilos.secundario }} onClick={() => window.location.assign('/')}>
            <i className="fa-solid fa-house" /> Ir al inicio
          </button>
        </div>
      </div>
    );
  }
}

const estilos: Record<string, CSSProperties> = {
  contenedor: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 16, padding: 24, textAlign: 'center', background: 'radial-gradient(circle at center, rgba(57,169,0,0.12), var(--bg) 60%)',
    color: 'var(--text)', fontFamily: 'var(--font-body)',
  },
  circulo: {
    width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '2px solid var(--red)', background: 'rgba(231,76,60,0.12)', boxShadow: '0 0 28px rgba(231,76,60,0.55)',
  },
  titulo: { margin: 0, fontFamily: 'var(--font-title)', fontWeight: 900 },
  mensaje: { margin: 0, maxWidth: 440, color: 'var(--dim)', lineHeight: 1.5 },
  boton: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 999, cursor: 'pointer',
    border: '1px solid var(--green)', background: 'var(--green)', color: '#fff', fontWeight: 800,
    boxShadow: '0 0 18px rgba(57,169,0,0.45)',
  },
  secundario: { background: 'transparent', color: 'var(--text)', boxShadow: 'none', borderColor: 'var(--border)' },
};
