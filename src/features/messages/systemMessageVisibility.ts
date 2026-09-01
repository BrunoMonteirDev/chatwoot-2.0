import type { ConversationMessage } from '../../domain/currentUser';

export const showSystemMessagesFrom = (uiSettings: Record<string, unknown> | null | undefined): boolean => uiSettings?.show_system_messages !== false;

// This is intentionally a view projection. History, pagination and the
// in-memory cache must retain activities so changing the preference is instant.
export const visibleConversationMessages = (messages: ConversationMessage[], showSystemMessages: boolean): ConversationMessage[] => (
  showSystemMessages ? messages : messages.filter((message) => message.kind !== 'activity')
);

export const uiSettingsWithSystemMessageVisibility = (uiSettings: Record<string, unknown> | null | undefined, showSystemMessages: boolean): Record<string, unknown> => ({
  ...(uiSettings || {}),
  show_system_messages: showSystemMessages,
});
