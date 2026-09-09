// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment, Chat, Message } from '../types';
import { ChatArea } from './ChatArea';

let container: HTMLDivElement;
let root: Root;
const attachment = (overrides: Partial<Attachment>): Attachment => ({ id: 'attachment-1', type: 'image', url: 'https://example.test/media', ...overrides });
const message = (attachments: Attachment[], text?: string): Message => ({ id: 'message-1', sender: 'them', time: '10:21', attachments, text });
const renderMedia = async (attachments: Attachment[], text?: string, onImageClick = vi.fn()) => act(async () => {
  const chat: Chat = { id: '81', name: 'Ana', avatar: '', lastMessage: '', time: '', messages: [message(attachments, text)], isGroup: false };
  root.render(<ChatArea chat={chat} onSendMessage={vi.fn()} onImageClick={onImageClick} onSearchInChat={vi.fn()} />);
});

describe('ChatArea media layout', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('preserva dimensão natural de imagem pequena e limita imagens landscape/portrait sem MIME visível', async () => {
    await renderMedia([attachment({ title: 'foto.jpg', subtitle: 'image/jpeg', width: 250, height: 250 })]);
    const image = container.querySelector('img[alt="foto.jpg"]') as HTMLImageElement;
    expect(image.width).toBe(250);
    expect(image.height).toBe(250);
    expect(image.className).toContain('w-auto');
    expect(image.className).toContain('md:max-w-[460px]');
    expect(image.className).toContain('max-h-[62vh]');
    expect(image.className).toContain('md:max-h-[min(580px,65vh)]');
    expect(image.className).toContain('object-contain');
    expect(container.textContent).not.toContain('foto.jpg');
    expect(container.textContent).not.toContain('image/jpeg');
  });

  it('mantém caption compacta e abre a imagem no viewer existente', async () => {
    const open = vi.fn();
    await renderMedia([attachment({ title: 'foto.jpg', width: 1200, height: 800 })], 'Legenda curta', open);
    expect(container.textContent).toContain('Legenda curta');
    await act(async () => (container.querySelector('img[alt="foto.jpg"]')?.parentElement as HTMLElement).click());
    expect(open).toHaveBeenCalledWith('https://example.test/media', 'foto.jpg', undefined);
  });

  it('usa player de vídeo proporcional com poster e limites responsivos', async () => {
    await renderMedia([attachment({ type: 'video', previewUrl: 'https://example.test/poster.jpg', width: 1920, height: 1080 })]);
    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.poster).toBe('https://example.test/poster.jpg');
    expect(video.className).toContain('max-w-full');
    expect(video.className).toContain('md:max-w-[460px]');
    expect(video.className).toContain('max-h-[62vh]');
  });

  it('renderiza documento como card horizontal compacto sem área vazia', async () => {
    await renderMedia([attachment({ type: 'file', title: 'relatorio.pdf', subtitle: 'application/pdf', size: '2.4 MB' })]);
    expect(container.textContent).toContain('relatorio.pdf');
    expect(container.textContent).toContain('PDF · 2.4 MB');
    expect(container.querySelector('button[title="Baixar arquivo"]')).toBeTruthy();
    expect(container.querySelector('.max-w-\\[360px\\]')).toBeTruthy();
  });
});
