export type SendMessageShortcut = 'enter' | 'ctrl_enter';

type ComposerKeyboardEvent = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'>;

export const sendMessageShortcutFrom = (uiSettings: Record<string, unknown> | null | undefined): SendMessageShortcut => (
  uiSettings?.send_message_shortcut === 'ctrl_enter' ? 'ctrl_enter' : 'enter'
);

export const uiSettingsWithSendMessageShortcut = (
  uiSettings: Record<string, unknown> | null | undefined,
  sendMessageShortcut: SendMessageShortcut,
): Record<string, unknown> => ({
  ...(uiSettings || {}),
  send_message_shortcut: sendMessageShortcut,
});

// Keep the decision independent from React so every keyboard variant can be
// tested without rendering the composer.
export const shouldSendMessageOnEnter = (event: ComposerKeyboardEvent, sendMessageShortcut: SendMessageShortcut): boolean => {
  if (event.key !== 'Enter' || event.isComposing || event.shiftKey) return false;
  return sendMessageShortcut === 'enter' || event.ctrlKey || event.metaKey;
};
