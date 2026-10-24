import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './routes/AppRouter';
import { AuthProvider } from './context/AuthContext';
import { LimiteErrores } from './components/LimiteErrores';
import './styles.css';
import './styles/responsive.css';
import './styles/tema-claro.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LimiteErrores>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </LimiteErrores>
  </React.StrictMode>,
);
