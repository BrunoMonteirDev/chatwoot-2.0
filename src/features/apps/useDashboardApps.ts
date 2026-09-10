import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardApps, type DashboardApp } from './dashboardApps';

const cache = new Map<number, DashboardApp[]>();
const inFlight = new Map<number, Promise<DashboardApp[]>>();
export const enabledDashboardApps = (apps: DashboardApp[]) => apps.filter(app => app.enabled);
export const enabledDashboardAppForId = (apps: DashboardApp[], appId: string | number | null) => enabledDashboardApps(apps).find(app => String(app.id) === String(appId)) || null;

export const useDashboardApps = (accountId: number | null) => {
  const [apps, setApps] = useState<DashboardApp[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const requestVersion = useRef(0);
  const reload = useCallback(async (force = true) => {
    if (!accountId) { setApps([]); setStatus('idle'); return; }
    const version = ++requestVersion.current;
    const cached = cache.get(accountId);
    if (!force && cached) { setApps(cached); setStatus('ready'); return; }
    setApps(cached || []); setStatus('loading');
    try {
      let pending = inFlight.get(accountId);
      if (!pending) {
        pending = dashboardApps.list(accountId).then(next => { cache.set(accountId, next); return next; }).finally(() => inFlight.delete(accountId));
        inFlight.set(accountId, pending);
      }
      const next = await pending;
      cache.set(accountId, next);
      if (version !== requestVersion.current) return;
      setApps(next); setStatus('ready');
    }
    catch {
      if (version !== requestVersion.current) return;
      setApps([]); setStatus('error');
    }
  }, [accountId]);

  useEffect(() => {
    setApps([]);
    void reload(false);
    return () => { requestVersion.current += 1; };
  }, [reload]);
  useEffect(() => dashboardApps.subscribe(changedAccountId => { if (changedAccountId === accountId) void reload(); }), [accountId, reload]);
  const forceReload = useCallback(() => reload(true), [reload]);
  return { apps, enabledApps: enabledDashboardApps(apps), status, reload: forceReload };
};
