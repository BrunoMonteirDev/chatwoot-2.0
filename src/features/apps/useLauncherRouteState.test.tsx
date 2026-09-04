// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useLauncherRouteState } from './useLauncherRouteState';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const LauncherStateProbe = ({ appId }: { appId?: string }) => {
  const [activeAppId] = useLauncherRouteState(appId);
  return <output>{activeAppId}</output>;
};

beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

it('initializes the launcher route state during render before dependent sidebar state', () => {
  act(() => root.render(<LauncherStateProbe appId="59" />));
  expect(container.textContent).toBe('59');
});
