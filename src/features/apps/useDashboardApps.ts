import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardApps, type DashboardApp } from './dashboardApps';

const cache = new Map<number, DashboardApp[]>();
export const enabledDashboardApps = (apps: DashboardApp[]) => apps.filter(app => app.enabled);
export const enabledDashboardAppForId = (apps: DashboardApp[], appId: string | number | null) => enabledDashboardApps(apps).find(app => String(app.id) === String(appId)) || null;

export const useDashboardApps = (accountId: number | null) => {
  const [apps, setApps] = useState<DashboardApp[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const requestVersion = useRef(0);
  const reload = useCallback(async () => {
    if (!accountId) { setApps([]); setStatus('idle'); return; }
    const version = ++requestVersion.current;
    setApps(cache.get(accountId) || []); setStatus('loading');
    try {
      const next = await dashboardApps.list(accountId);
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
    void reload();
    return () => { requestVersion.current += 1; };
  }, [reload]);
  useEffect(() => dashboardApps.subscribe(changedAccountId => { if (changedAccountId === accountId) void reload(); }), [accountId, reload]);
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  return { apps, enabledApps: enabledDashboardApps(apps), status, reload };
};
