// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApps } from './dashboardApps';
import { enabledDashboardAppForId, enabledDashboardApps, useDashboardApps } from './useDashboardApps';

const app = (id: number, enabled = true) => ({ id, title: `App ${id}`, enabled, content: [{ type: 'frame' as const, url: 'https://app.example.test' }] });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
};

let container: HTMLDivElement;
let root: Root;
const DashboardAppsProbe = ({ accountId, onReload }: { accountId: number | null; onReload?: (reload: () => Promise<void>) => void }) => {
  const { apps, reload } = useDashboardApps(accountId);
  React.useEffect(() => { onReload?.(reload); }, [onReload, reload]);
  return React.createElement('output', null, apps.map(item => item.title).join(','));
};

describe('dashboard app launchers', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(dashboardApps, 'list').mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('exposes only enabled apps as sidebar launchers', () => {
    expect(enabledDashboardApps([app(1), app(2), app(3, false)])).toEqual([app(1), app(2)]);
  });

  it('does not resolve disabled or missing direct app routes', () => {
    expect(enabledDashboardAppForId([app(1), app(2, false)], 2)).toBeNull();
    expect(enabledDashboardAppForId([app(1)], 99)).toBeNull();
  });

  it('keeps only Account B apps when an older Account A response resolves last', async () => {
    const accountA = deferred<ReturnType<typeof app>[]>();
    const accountB = deferred<ReturnType<typeof app>[]>();
    vi.mocked(dashboardApps.list)
      .mockReturnValueOnce(accountA.promise)
      .mockReturnValueOnce(accountB.promise);

    await act(async () => { root.render(React.createElement(DashboardAppsProbe, { accountId: 101 })); });
    await act(async () => { root.render(React.createElement(DashboardAppsProbe, { accountId: 202 })); });
    await act(async () => { accountB.resolve([app(202)]); await accountB.promise; });
    expect(container.textContent).toBe('App 202');

    await act(async () => { accountA.resolve([app(101)]); await accountA.promise; });
    expect(container.textContent).toBe('App 202');
  });

  it('clears Account A apps immediately while Account B is loading', async () => {
    const accountA = deferred<ReturnType<typeof app>[]>();
    const accountB = deferred<ReturnType<typeof app>[]>();
    vi.mocked(dashboardApps.list)
      .mockReturnValueOnce(accountA.promise)
      .mockReturnValueOnce(accountB.promise);

    await act(async () => { root.render(React.createElement(DashboardAppsProbe, { accountId: 303 })); });
    await act(async () => { accountA.resolve([app(303)]); await accountA.promise; });
    expect(container.textContent).toBe('App 303');

    await act(async () => { root.render(React.createElement(DashboardAppsProbe, { accountId: 404 })); });
    expect(container.textContent).toBe('');
    await act(async () => { accountB.resolve([app(404)]); await accountB.promise; });
  });

  it('compartilha reloads concorrentes da mesma conta', async () => {
    const first = deferred<ReturnType<typeof app>[]>();
    let reload: (() => Promise<void>) | undefined;
    vi.mocked(dashboardApps.list).mockReturnValueOnce(first.promise);

    await act(async () => { root.render(React.createElement(DashboardAppsProbe, { accountId: 505, onReload: (next) => { reload = next; } })); });
    act(() => { void reload?.(); });
    await act(async () => { first.resolve([app(501)]); await first.promise; });
    expect(container.textContent).toBe('App 501');
    expect(dashboardApps.list).toHaveBeenCalledOnce();
  });

  it('não recarrega apps em rerender nem em focus da mesma sessão/conta', async () => {
    vi.mocked(dashboardApps.list).mockResolvedValue([app(606)]);
    await act(async () => { root.render(React.createElement(DashboardAppsProbe, { accountId: 606 })); });
    await act(async () => { root.render(React.createElement(DashboardAppsProbe, { accountId: 606 })); window.dispatchEvent(new Event('focus')); });
    expect(dashboardApps.list).toHaveBeenCalledOnce();
  });
});
