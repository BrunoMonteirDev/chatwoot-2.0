import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '../../domain/currentUser';
import { normalizeMessage } from '../../integrations/chatwoot/normalizers';
import { showSystemMessagesFrom, uiSettingsWithSystemMessageVisibility, visibleConversationMessages } from './systemMessageVisibility';

const message = (id: number, kind: ConversationMessage['kind']): ConversationMessage => ({
  id, conversationId: 1, kind, contentType: 'text', content: String(id), createdAt: id, updatedAt: null,
  status: 'sent', senderName: null, senderEmail: null, senderAvatarUrl: null, origin: null, attachments: [], contentAttributes: {},
});

describe('system message visibility', () => {
  it('defaults to enabled when the preference is absent', () => {
    expect(showSystemMessagesFrom(undefined)).toBe(true);
    expect(showSystemMessagesFrom({})).toBe(true);
    expect(showSystemMessagesFrom({ show_system_messages: false })).toBe(false);
  });

  it('hides only activities and retains normal, template and private messages', () => {
    const all = [message(1, 'activity'), message(2, 'incoming'), message(3, 'private_note'), message(4, 'template')];
    expect(visibleConversationMessages(all, false).map((item) => item.kind)).toEqual(['incoming', 'private_note', 'template']);
    expect(all).toHaveLength(4); // the cache/history source is never mutated
  });

  it('merges the preference without losing existing ui_settings', () => {
    expect(uiSettingsWithSystemMessageVisibility({ locale: 'pt_BR', is_contact_sidebar_open: false }, false))
      .toEqual({ locale: 'pt_BR', is_contact_sidebar_open: false, show_system_messages: false });
  });

  it('keeps a realtime activity in history while hiding it from the view', () => {
    const realtimeActivity = normalizeMessage({ id: 9, conversation_id: 1, message_type: 2, content_type: 'text', private: false, created_at: 100, content: 'Atribuído a Ana' });
    const history = [message(1, 'incoming'), realtimeActivity];
    expect(history).toHaveLength(2);
    expect(visibleConversationMessages(history, false).map((item) => item.id)).toEqual([1]);
  });
});
