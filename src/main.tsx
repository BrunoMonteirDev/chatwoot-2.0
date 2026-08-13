import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { AuthProvider } from './features/auth/AuthContext.tsx';
import { AppBootstrap } from './components/auth/AppBootstrap.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppBootstrap />
    </AuthProvider>
  </StrictMode>,
);
