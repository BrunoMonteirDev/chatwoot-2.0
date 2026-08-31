import { describe, expect, it } from 'vitest';
import { normalizeBrazilianPhone } from './phone';

describe('normalizeBrazilianPhone', () => {
  it('removes the additional ninth digit from Brazilian mobile numbers', () => {
    expect(normalizeBrazilianPhone('5544984532595')).toBe('554484532595');
    expect(normalizeBrazilianPhone('+5544984532595')).toBe('+554484532595');
  });

  it('keeps canonical Brazilian and non-Brazilian numbers unchanged', () => {
    expect(normalizeBrazilianPhone('554484532595')).toBe('554484532595');
    expect(normalizeBrazilianPhone('+14155552671')).toBe('+14155552671');
  });
});
