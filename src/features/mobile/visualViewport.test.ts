import { describe, expect, it } from 'vitest';
import { applyVisualViewport, measureVisualViewport } from './visualViewport';
describe('mobile visual viewport', () => {
  it('uses the visible area above an open keyboard including its offset', () => { expect(measureVisualViewport({ height: 438.4, offsetTop: 52.6, width: 390 }, { innerHeight: 844, innerWidth: 390 })).toEqual({ height: 438, offsetTop: 53, width: 390 }); });
  it('falls back for a closed keyboard without visualViewport', () => { expect(measureVisualViewport(null, { innerHeight: 844, innerWidth: 390 })).toEqual({ height: 844, offsetTop: 0, width: 390 }); });
  it('updates shell variables for rotation and reflow', () => { const values = new Map<string, string>(); applyVisualViewport({ setProperty: (key: string, value: string) => { values.set(key, value); } } as CSSStyleDeclaration, { height: 390, offsetTop: 0, width: 844 }); expect(Object.fromEntries(values)).toEqual({ '--app-viewport-height': '390px', '--app-viewport-offset-top': '0px', '--app-viewport-width': '844px' }); });
});
