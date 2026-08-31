import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { AuthProvider } from './features/auth/AuthContext.tsx';
import { AppBootstrap } from './components/auth/AppBootstrap.tsx';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // The offline cache is not worth risking the live conversation UI. Older
    // versions intercepted attachment and navigation requests; unregister them
    // once, then reload outside the worker's control.
    void navigator.serviceWorker.getRegistrations()
      .then(async (registrations) => {
        const results = await Promise.all(registrations.map((registration) => registration.unregister()));
        if (results.some(Boolean)) window.location.reload();
      })
      .catch((error: unknown) => console.warn('Não foi possível remover o cache offline antigo.', error));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppBootstrap />
    </AuthProvider>
  </StrictMode>,
);
