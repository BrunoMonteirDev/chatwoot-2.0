import { describe, expect, it } from 'vitest';
import { messageBubbleWidthClassName, messageTimelineClassName, messageVisualMediaClassName } from './messageLayout';

describe('responsive message layout', () => {
  it('keeps short messages content-sized while allowing wider long bubbles', () => {
    expect(messageBubbleWidthClassName(false)).toContain('w-fit');
    expect(messageBubbleWidthClassName(false)).toContain('sm:max-w-[88%]');
    expect(messageBubbleWidthClassName(false)).toContain('xl:max-w-[76%]');
    expect(messageBubbleWidthClassName(false)).not.toContain('w-full');
  });
  it('allows visual media to use the available width without exceeding the conversation', () => {
    expect(messageBubbleWidthClassName(true)).toContain('w-full');
    expect(messageBubbleWidthClassName(true)).toContain('md:max-w-[52rem]');
    expect(messageVisualMediaClassName).toContain('max-h-[72vh]');
    expect(messageVisualMediaClassName).toContain('object-contain');
  });
  it('uses compact timeline gutters from mobile through desktop', () => {
    expect(messageTimelineClassName).toContain('px-2');
    expect(messageTimelineClassName).toContain('md:px-5');
    expect(messageTimelineClassName).not.toContain('md:px-12');
  });
});
