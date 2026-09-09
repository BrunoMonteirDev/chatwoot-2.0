import { useCallback, useEffect, useState } from 'react';
import type { AccountLabel } from '../../domain/currentUser';
import { labelCatalog, type LabelInput } from './labelCatalog';

export const useAccountLabels = (accountId: number | null) => {
  const [labels, setLabels] = useState<AccountLabel[]>(() => accountId ? labelCatalog.peek(accountId) || [] : []);
  const [labelsAccountId, setLabelsAccountId] = useState<number | null>(accountId);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(() => accountId && labelCatalog.peek(accountId) ? 'ready' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) return;
    setStatus(labelCatalog.peek(accountId) ? 'ready' : 'loading');
    setError(null);
    try { setLabels(await labelCatalog.list(accountId)); setLabelsAccountId(accountId); setStatus('ready'); }
    catch { setError('Não foi possível carregar as etiquetas.'); setStatus('error'); }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) { setLabels([]); setLabelsAccountId(null); setStatus('idle'); return; }
    setLabels(labelCatalog.peek(accountId) || []);
    setLabelsAccountId(accountId);
    const unsubscribe = labelCatalog.subscribe(accountId, next => { setLabels(next); setLabelsAccountId(accountId); });
    void load();
    return unsubscribe;
  }, [accountId, load]);

  return {
    labels: labelsAccountId === accountId ? labels : [], status, error, retry: load,
    create: (input: LabelInput) => accountId ? labelCatalog.create(accountId, input) : Promise.reject(new Error('Conta indisponível.')),
    update: (id: number, input: LabelInput) => accountId ? labelCatalog.update(accountId, id, input) : Promise.reject(new Error('Conta indisponível.')),
    remove: (id: number) => accountId ? labelCatalog.delete(accountId, id) : Promise.reject(new Error('Conta indisponível.')),
  };
};
