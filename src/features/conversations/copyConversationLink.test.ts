import { describe, expect, it, vi } from 'vitest';
import { copyConversationLink } from './copyConversationLink';

describe('copyConversationLink', () => {
  it('copies the canonical absolute URL and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const onCopied = vi.fn();

    await expect(copyConversationLink({
      origin: 'https://kopla.example.test', accountId: 42, conversationId: 698,
      clipboard: { writeText }, onCopied,
    })).resolves.toBe('https://kopla.example.test/app/accounts/42/conversations/698');

    expect(writeText).toHaveBeenCalledWith('https://kopla.example.test/app/accounts/42/conversations/698');
    expect(onCopied).toHaveBeenCalledOnce();
  });

  it('does not show feedback when copying fails', async () => {
    const onCopied = vi.fn();
    await expect(copyConversationLink({
      origin: 'https://kopla.example.test', accountId: 42, conversationId: 698,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) }, onCopied,
    })).rejects.toThrow('blocked');
    expect(onCopied).not.toHaveBeenCalled();
  });
});
