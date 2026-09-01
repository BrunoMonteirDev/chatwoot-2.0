import { describe, expect, it } from 'vitest';
import { sendMessageShortcutFrom, shouldSendMessageOnEnter, uiSettingsWithSendMessageShortcut } from './sendMessageShortcut';

const keyEvent = (overrides: Partial<KeyboardEvent> = {}): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'> => ({
  key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false, ...overrides,
});

describe('send message shortcut', () => {
  it('defaults to Enter and accepts only supported settings', () => {
    expect(sendMessageShortcutFrom(undefined)).toBe('enter');
    expect(sendMessageShortcutFrom({ send_message_shortcut: 'invalid' })).toBe('enter');
    expect(sendMessageShortcutFrom({ send_message_shortcut: 'ctrl_enter' })).toBe('ctrl_enter');
  });

  it('merges the shortcut without losing existing ui_settings', () => {
    expect(uiSettingsWithSendMessageShortcut({ show_system_messages: false, locale: 'pt_BR' }, 'ctrl_enter'))
      .toEqual({ show_system_messages: false, locale: 'pt_BR', send_message_shortcut: 'ctrl_enter' });
  });

  it.each([
    ['Enter', keyEvent(), true],
    ['Shift+Enter', keyEvent({ shiftKey: true }), false],
    ['Ctrl+Enter', keyEvent({ ctrlKey: true }), true],
    ['Cmd+Enter', keyEvent({ metaKey: true }), true],
    ['Ctrl+Shift+Enter', keyEvent({ ctrlKey: true, shiftKey: true }), false],
    ['Cmd+Shift+Enter', keyEvent({ metaKey: true, shiftKey: true }), false],
    ['IME Enter', keyEvent({ isComposing: true }), false],
  ])('uses the expected Enter behavior in enter mode: %s', (_, event, expected) => {
    expect(shouldSendMessageOnEnter(event, 'enter')).toBe(expected);
  });

  it.each([
    ['Enter', keyEvent(), false],
    ['Shift+Enter', keyEvent({ shiftKey: true }), false],
    ['Ctrl+Enter', keyEvent({ ctrlKey: true }), true],
    ['Cmd+Enter', keyEvent({ metaKey: true }), true],
    ['Ctrl+Shift+Enter', keyEvent({ ctrlKey: true, shiftKey: true }), false],
    ['Cmd+Shift+Enter', keyEvent({ metaKey: true, shiftKey: true }), false],
    ['IME Ctrl+Enter', keyEvent({ ctrlKey: true, isComposing: true }), false],
  ])('uses the expected Enter behavior in ctrl_enter mode: %s', (_, event, expected) => {
    expect(shouldSendMessageOnEnter(event, 'ctrl_enter')).toBe(expected);
  });
});
