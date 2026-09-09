import { describe, expect, it } from 'vitest';
import { messageBubbleWidthClassName, messageTimelineClassName, messageVisualMediaClassName } from './messageLayout';

describe('responsive message layout', () => {
  it('keeps short messages content-sized while allowing wider long bubbles', () => {
    expect(messageBubbleWidthClassName(false)).toContain('w-fit');
    expect(messageBubbleWidthClassName(false)).toContain('sm:max-w-[88%]');
    expect(messageBubbleWidthClassName(false)).toContain('xl:max-w-[76%]');
    expect(messageBubbleWidthClassName(false)).not.toContain('w-full');
  });
  it('keeps visual media natural-sized within compact responsive limits', () => {
    expect(messageBubbleWidthClassName(true)).toContain('w-fit');
    expect(messageBubbleWidthClassName(true)).toContain('sm:max-w-[90%]');
    expect(messageBubbleWidthClassName(true)).toContain('md:max-w-[30rem]');
    expect(messageVisualMediaClassName).toContain('w-auto');
    expect(messageVisualMediaClassName).toContain('max-w-full');
    expect(messageVisualMediaClassName).toContain('max-h-[62vh]');
    expect(messageVisualMediaClassName).toContain('md:max-w-[460px]');
    expect(messageVisualMediaClassName).toContain('md:max-h-[min(580px,65vh)]');
    expect(messageVisualMediaClassName).toContain('object-contain');
  });
  it('uses compact timeline gutters from mobile through desktop', () => {
    expect(messageTimelineClassName).toContain('px-2');
    expect(messageTimelineClassName).toContain('md:px-5');
    expect(messageTimelineClassName).not.toContain('md:px-12');
  });
});
