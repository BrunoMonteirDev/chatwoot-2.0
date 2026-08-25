import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { AuthProvider } from './features/auth/AuthContext.tsx';
import { AppBootstrap } from './components/auth/AppBootstrap.tsx';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error: unknown) => {
      console.warn('Não foi possível registrar o modo offline.', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppBootstrap />
    </AuthProvider>
  </StrictMode>,
);
