import { useEffect, useState } from 'react';
import type { CustomAttributeDefinition } from '../../domain/currentUser';
import { customAttributeCatalog } from './customAttributeCatalog';
export const useCustomAttributes = (accountId: number | null) => {
  const [items, setItems] = useState<CustomAttributeDefinition[]>(() => accountId ? customAttributeCatalog.peek(accountId) || [] : []);
  const [status, setStatus] = useState<'loading'|'ready'|'error'>(accountId && customAttributeCatalog.peek(accountId) ? 'ready' : 'loading');
  useEffect(() => { if (!accountId) { setItems([]); return; } setItems(customAttributeCatalog.peek(accountId) || []); const unsubscribe = customAttributeCatalog.subscribe(accountId, setItems); void customAttributeCatalog.list(accountId).then(value => { setItems(value); setStatus('ready'); }).catch(() => setStatus('error')); return unsubscribe; }, [accountId]);
  return { items, status };
};
