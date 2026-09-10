import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../types';
import { getMessageContextMenuItems } from './contextMenuActions';

const message: Message = {
  id: '42', sender: 'me', text: 'Mensagem', time: '10:00', sourceId: 'waha:SYNTHETIC',
  whatsappTransport: 'waha', whatsappRemoteJid: '5500000000001@c.us', whatsappFromMe: true,
};

describe('message context actions', () => {
  it('offers provider revoke but never the destructive Chatwoot deletion', () => {
    const labels = getMessageContextMenuItems(message, { onRevokeMessage: vi.fn() }).map(item => item.label);

    expect(labels).toContain('Apagar para todos');
    expect(labels).not.toContain('Excluir do Chatwoot');
  });
});
