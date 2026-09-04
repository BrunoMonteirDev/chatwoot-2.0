import { describe, expect, it } from 'vitest';
import { audioDurationLabel, isAtConversationBottom, preservedScrollTopAfterPrepend } from './scroll';

describe('conversation scroll rules', () => {
  it('identifies sticky bottom without treating history readers as sticky', () => {
    expect(isAtConversationBottom(1_000, 600, 400)).toBe(true);
    expect(isAtConversationBottom(1_000, 300, 400)).toBe(false);
  });

  it('preserves the visible anchor when history is prepended', () => {
    expect(preservedScrollTopAfterPrepend(120, 1_000, 1_360)).toBe(480);
  });

  it('turns delayed, unknown, and failed audio metadata into display-only labels', () => {
    expect(audioDurationLabel(65, '—:—')).toBe('1:05');
    expect(audioDurationLabel(null, '—:—')).toBe('—:—');
  });
});
