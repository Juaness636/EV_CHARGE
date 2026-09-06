import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verificarEmail } from '../api/auth.api';

export function VerificarEmail() {
  const [params] = useSearchParams();
  const [estado, setEstado] = useState<'cargando' | 'exito' | 'error'>('cargando');
  const [mensaje, setMensaje] = useState('Estamos confirmando tu correo...');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setEstado('error');
      setMensaje('El enlace de verificación está incompleto.');
      return;
    }

    verificarEmail(token)
      .then((respuesta) => {
        setEstado('exito');
        setMensaje(respuesta.message);
      })
      .catch((error: any) => {
        setEstado('error');
        setMensaje(error?.response?.data?.detail || 'No pudimos verificar el correo. Solicita un enlace nuevo.');
      });
  }, [params]);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#0d1117', color: '#fff' }}>
      <section style={{ width: '100%', maxWidth: 460, padding: 32, border: '1px solid #30363d', borderTop: '4px solid #39a900', borderRadius: 16, background: '#161b22', textAlign: 'center' }}>
        <img src="/img/logo.png" alt="EV Charge" style={{ width: 110, marginBottom: 20 }} />
        <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>{estado === 'cargando' ? 'Verificando correo' : estado === 'exito' ? 'Correo confirmado' : 'No se pudo confirmar'}</h1>
        <p style={{ color: '#aab2bd', lineHeight: 1.5, marginBottom: 24 }}>{mensaje}</p>
        {estado !== 'cargando' && <Link to="/" style={{ display: 'inline-block', padding: '12px 20px', borderRadius: 8, background: '#39a900', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Ir al inicio</Link>}
      </section>
    </main>
  );
}
