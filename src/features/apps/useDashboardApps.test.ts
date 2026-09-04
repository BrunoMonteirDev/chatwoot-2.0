import { describe, expect, it } from 'vitest';
import { enabledDashboardAppForId, enabledDashboardApps } from './useDashboardApps';

const app = (id: number, enabled = true) => ({ id, title: `App ${id}`, enabled, content: [{ type: 'frame' as const, url: 'https://app.example.test' }] });

describe('dashboard app launchers', () => {
  it('exposes only enabled apps as sidebar launchers', () => {
    expect(enabledDashboardApps([app(1), app(2), app(3, false)])).toEqual([app(1), app(2)]);
  });

  it('does not resolve disabled or missing direct app routes', () => {
    expect(enabledDashboardAppForId([app(1), app(2, false)], 2)).toBeNull();
    expect(enabledDashboardAppForId([app(1)], 99)).toBeNull();
  });

  it('clears previous account launchers before the next account response is applied', () => {
    expect(enabledDashboardApps([])).toEqual([]);
  });
});
