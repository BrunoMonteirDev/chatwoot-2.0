// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appSource from '../App.tsx?raw';
import type { Chat } from '../types';
import { ChatArea } from './ChatArea';
import { ChatListItem } from './ChatListItem';

const conversations: Chat[] = ['A', 'B', 'C'].map((name, index) => ({ id: String(index + 1), name, avatar: name, lastMessage: '', time: '', messages: [] }));
const SelectionFlow = () => {
  const [conversationId, setConversationId] = useState('');
  const selected = conversations.find(item => item.id === conversationId);
  return <><div>{conversations.map(item => <ChatListItem key={item.id} chat={item} isSelected={item.id === conversationId} onSelect={chat => setConversationId(chat.id)} />)}</div>{selected && <div data-testid={`chat-area-${selected.id}`}><ChatArea chat={selected} onSendMessage={vi.fn()} onImageClick={vi.fn()} onSearchInChat={vi.fn()} /></div>}</>;
};

describe('conversation selection hotfix', () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; Element.prototype.scrollIntoView = vi.fn(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  it('abre A, troca A → B → C e volta para A sem exception', async () => {
    await act(async () => root.render(<SelectionFlow />));
    for (const name of ['A', 'B', 'C', 'A']) {
      await act(async () => Array.from(container.querySelectorAll('div')).find(element => element.textContent === name)?.click());
      const id = String(conversations.find(item => item.name === name)!.id);
      expect(container.querySelector(`[data-testid="chat-area-${id}"]`)).toBeTruthy();
    }
  });
  it('não deixa chamadas residuais para telemetria removida no App', () => {
    expect(appSource).not.toContain('markConversationOpen');
    expect(appSource).not.toContain('markConversationPrefetched');
  });
  it('prefetch exige hover de mouse sustentado e ignora touch', async () => {
    vi.useFakeTimers();
    const prefetch = vi.fn();
    await act(async () => root.render(<ChatListItem chat={conversations[0]} isSelected={false} onSelect={() => undefined} onPrefetch={prefetch} />));
    const row = container.firstElementChild as HTMLElement;
    const pointer = (type: string, pointerType: string) => { const event = new Event(type, { bubbles: true }); Object.defineProperty(event, 'pointerType', { value: pointerType }); return event; };
    await act(async () => { row.dispatchEvent(pointer('pointerover', 'mouse')); vi.advanceTimersByTime(399); });
    expect(prefetch).not.toHaveBeenCalled();
    await act(async () => { row.dispatchEvent(pointer('pointerout', 'mouse')); vi.advanceTimersByTime(1); });
    expect(prefetch).not.toHaveBeenCalled();
    await act(async () => { row.dispatchEvent(pointer('pointerover', 'touch')); vi.advanceTimersByTime(500); });
    expect(prefetch).not.toHaveBeenCalled();
    await act(async () => { row.dispatchEvent(pointer('pointerover', 'mouse')); vi.advanceTimersByTime(400); });
    expect(prefetch).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
