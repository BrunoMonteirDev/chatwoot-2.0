import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import App from '../../App';
import { LoginScreen } from './LoginScreen';

export const AppBootstrap = () => {
  const { status, error, retryBootstrap } = useAuth();
  if (status === 'loading') return <main className="min-h-screen bg-[#0b141a] text-slate-200 flex items-center justify-center gap-3"><LoaderCircle className="animate-spin" /> Verificando sessão…</main>;
  if (status === 'error') return <main className="min-h-screen bg-[#0b141a] text-slate-200 flex items-center justify-center p-5"><section className="max-w-md rounded-xl bg-[#111b21] p-6 text-center"><AlertTriangle className="mx-auto mb-3 text-amber-400" /><p>{error || 'Não foi possível validar a sessão.'}</p><button onClick={() => void retryBootstrap()} className="mt-4 rounded-lg bg-[#25d366] px-4 py-2 text-[#0b141a]">Tentar novamente</button></section></main>;
  if (status === 'unauthenticated') return <LoginScreen />;
  return <App />;
};
