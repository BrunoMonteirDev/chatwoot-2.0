import { FormEvent, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';
import { useAuth } from '../../features/auth/AuthContext';

export const LoginScreen = () => {
  const { login, verifyMfa } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const attemptLogin = async () => {
    if (isSubmitting) return;
    setError(null);
    setMfaToken(null);
    setIsSubmitting(true);
    try {
      const result = await login({ email, password });
      setMfaToken(result?.mfa_token ?? null);
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await attemptLogin();
  };

  const onMfaSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!mfaToken || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyMfa({ mfaToken, otpCode: mfaCode });
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b141a] text-slate-100 flex items-center justify-center p-5">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111b21] p-7 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <img src="/icons/Captura%20de%20tela%20de%202026-08-28%2013-59-03.svg" alt="Kopla" className="h-14 w-14 rounded-xl object-cover" />
          <div><h1 className="text-xl font-semibold">Kopla Chat</h1><p className="text-sm text-slate-400">Entre com sua conta Kopla</p></div>
        </div>
        {!mfaToken ? <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm text-slate-300">E-mail
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#202c33] px-3 py-2.5 text-white outline-none focus:border-[#25d366]" />
          </label>
          <label className="block text-sm text-slate-300">Senha
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#202c33] px-3 py-2.5 text-white outline-none focus:border-[#25d366]" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button disabled={isSubmitting} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25d366] px-4 py-2.5 font-medium text-[#0b141a] disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting && <LoaderCircle className="animate-spin" size={18} />}{isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form> : <form onSubmit={onMfaSubmit} className="space-y-4">
          <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100">Esta conta exige autenticação em duas etapas.</p>
          <label className="block text-sm text-slate-300">Código do autenticador
            <input required inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#202c33] px-3 py-2.5 text-white outline-none focus:border-[#25d366]" />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
          <button disabled={isSubmitting} type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25d366] px-4 py-2.5 font-medium text-[#0b141a] disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting && <LoaderCircle className="animate-spin" size={18} />}{isSubmitting ? 'Validando…' : 'Validar código'}
          </button>
          <button type="button" onClick={() => { setMfaToken(null); setMfaCode(''); setError(null); }} className="w-full text-sm text-slate-400 hover:text-white">Usar outra conta</button>
        </form>}
      </section>
    </main>
  );
};
