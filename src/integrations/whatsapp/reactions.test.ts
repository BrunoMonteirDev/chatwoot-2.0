import { describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn().mockResolvedValue({}) }));
vi.mock('../chatwoot/client', () => ({ chatwootApiClient: { post } }));

import { nativeMetaReactionService, routedWhatsAppReactionService } from './reactions';

describe('native Meta reactions', () => {
  it('uses the authenticated Rails endpoint and never the bridge', async () => {
    await nativeMetaReactionService.send(1, 66, 1049, '👍');

    expect(post).toHaveBeenCalledWith('/api/v1/accounts/1/conversations/66/messages/1049/native_whatsapp_reaction', { emoji: '👍' });
  });

  it('routes an official Hybrid WAHA reaction to Rails without a browser-selected session', async () => {
    await routedWhatsAppReactionService.send({ accountId: 1, inboxId: 5, conversationId: 78, messageId: 1299, sourceId: 'waha:target', remoteJid: '120@g.us', targetFromMe: true, providerMessageKey: 'true_120@g.us_target_5544@c.us', transport: 'waha', emoji: '❤️' }, true);

    expect(post).toHaveBeenCalledWith('/api/v1/accounts/1/conversations/78/messages/1299/native_whatsapp_reaction', { emoji: '❤️' });
  });
});
