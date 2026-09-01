import { describe, expect, it } from 'vitest';
import { capabilitiesForMessage } from './capabilities';
import type { Message } from '../../types';

const message = (overrides: Partial<Message> = {}): Message => ({
  id: '1', sender: 'me', text: 'Olá', time: '10:00', sourceId: 'evolution:ABC', whatsappTransport: 'evolution', whatsappRemoteJid: '5511999999999@s.whatsapp.net', whatsappFromMe: true,
  ...overrides,
});

describe('message capabilities', () => {
  it('uses the provider encoded in source_id for hybrid inbox messages', () => {
    expect(capabilitiesForMessage(message({ sourceId: 'waha:ABC', whatsappTransport: 'evolution' }))).toMatchObject({ transport: 'waha', canReact: true, canEdit: true, canRevoke: true });
  });

  it('allows reactions for Meta but does not expose edit or revoke', () => {
    expect(capabilitiesForMessage(message({ sourceId: 'meta:wamid.1', whatsappTransport: 'meta_cloud' }))).toMatchObject({ canReact: true, canEdit: false, canRevoke: false });
  });

  it('requires an original provider identity and allows only compatible own messages to mutate', () => {
    expect(capabilitiesForMessage(message({ sourceId: null }))).toMatchObject({ canReact: false, canEdit: false, canRevoke: false });
    expect(capabilitiesForMessage(message({ sender: 'them', whatsappFromMe: false }))).toMatchObject({ canReact: true, canEdit: false, canRevoke: false });
    expect(capabilitiesForMessage(message({ attachments: [{ id: 'a', type: 'file', url: '/a' }] }))).toMatchObject({ canEdit: false, canRevoke: true });
  });
});
