import { describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn().mockResolvedValue({}) }));
vi.mock('../chatwoot/client', () => ({ chatwootApiClient: { post } }));

import { nativeMetaReactionService } from './reactions';

describe('native Meta reactions', () => {
  it('uses the authenticated Rails endpoint and never the bridge', async () => {
    await nativeMetaReactionService.send(1, 66, 1049, '👍');

    expect(post).toHaveBeenCalledWith('/api/v1/accounts/1/conversations/66/messages/1049/native_whatsapp_reaction', { emoji: '👍' });
  });
});
