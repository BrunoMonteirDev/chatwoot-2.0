import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_APP_SANDBOX,
  isAllowedDashboardAppUrl,
  nextEmbedStatus,
} from './embedPolicy';

describe('dashboard app embed policy', () => {
  it('allows HTTPS apps without a fetch or CORS probe', () => {
    expect(isAllowedDashboardAppUrl('https://app.example.com/dashboard')).toBe(
      true
    );
  });

  it('keeps loading until the iframe reports an outcome', () => {
    expect(nextEmbedStatus('load')).toBe('ready');
    expect(nextEmbedStatus('error')).toBe('blocked');
  });

  it('keeps insecure URLs blocked outside local development', () => {
    expect(isAllowedDashboardAppUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedDashboardAppUrl('data:text/html,blocked')).toBe(false);
    expect(isAllowedDashboardAppUrl('file:///tmp/app.html')).toBe(false);
    expect(isAllowedDashboardAppUrl('http://app.example.com')).toBe(false);
    expect(isAllowedDashboardAppUrl('http://localhost:4173', true)).toBe(true);
  });

  it('keeps the iframe sandboxed without navigation or popup permissions', () => {
    expect(DASHBOARD_APP_SANDBOX).toBe(
      'allow-forms allow-same-origin allow-scripts'
    );
    expect(DASHBOARD_APP_SANDBOX).not.toContain('allow-top-navigation');
    expect(DASHBOARD_APP_SANDBOX).not.toContain('allow-popups');
  });
});
