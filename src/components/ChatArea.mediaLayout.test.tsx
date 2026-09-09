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

  it('reserva a dimensão natural de imagem pequena antes do load sem MIME visível', async () => {
    await renderMedia([attachment({ title: 'foto.jpg', subtitle: 'image/jpeg', width: 250, height: 250 })]);
    const image = container.querySelector('img[alt="foto.jpg"]') as HTMLImageElement;
    const frame = image.parentElement as HTMLElement;
    expect(image.width).toBe(250);
    expect(image.height).toBe(250);
    expect(frame.style.width).toBe('250px');
    expect(frame.style.aspectRatio).toBe('250 / 250');
    expect(frame.dataset.mediaSource).toBe('attachment');
    expect(image.getAttribute('loading')).toBe('lazy');
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
    const frame = video.parentElement as HTMLElement;
    expect(video.controls).toBe(true);
    expect(video.poster).toBe('https://example.test/poster.jpg');
    expect(frame.style.width).toBe('460px');
    expect(frame.style.aspectRatio).toBe('1920 / 1080');
    expect(video.className).toContain('h-full');
    expect(video.className).toContain('object-contain');
  });

  it('mantém o mesmo frame antes/depois do load e persiste dimensões legadas sem scroll corretivo', async () => {
    const dimensions = vi.fn();
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scroll });
    const chat: Chat = { id: '81', name: 'Ana', avatar: '', lastMessage: '', time: '', messages: [message([attachment({})])], isGroup: false };
    await act(async () => root.render(<ChatArea chat={chat} onSendMessage={vi.fn()} onImageClick={vi.fn()} onSearchInChat={vi.fn()} onAttachmentDimensionsResolved={dimensions} />));
    await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
    scroll.mockClear();
    const image = container.querySelector('img[alt="Attachment"]') as HTMLImageElement;
    const frame = image.parentElement as HTMLElement;
    const before = frame.getAttribute('style');
    expect(container.querySelector('[aria-label="Carregando imagem"]')).toBeTruthy();
    Object.defineProperty(image, 'naturalWidth', { value: 1600, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 900, configurable: true });
    await act(async () => image.dispatchEvent(new Event('load')));
    expect(frame.getAttribute('style')).toBe(before);
    expect(container.querySelector('[aria-label="Carregando imagem"]')).toBeNull();
    expect(dimensions).toHaveBeenCalledWith('message-1', 'attachment-1', 1600, 900);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('mantém fallback de vídeo estável e aprende videoWidth/videoHeight em background', async () => {
    const dimensions = vi.fn();
    const chat: Chat = { id: '81', name: 'Ana', avatar: '', lastMessage: '', time: '', messages: [message([attachment({ type: 'video' })])], isGroup: false };
    await act(async () => root.render(<ChatArea chat={chat} onSendMessage={vi.fn()} onImageClick={vi.fn()} onSearchInChat={vi.fn()} onAttachmentDimensionsResolved={dimensions} />));
    const video = container.querySelector('video') as HTMLVideoElement;
    const frame = video.parentElement as HTMLElement;
    const before = frame.getAttribute('style');
    Object.defineProperty(video, 'videoWidth', { value: 1080, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1920, configurable: true });
    await act(async () => video.dispatchEvent(new Event('loadedmetadata')));
    expect(frame.getAttribute('style')).toBe(before);
    expect(dimensions).toHaveBeenCalledWith('message-1', 'attachment-1', 1080, 1920);
  });

  it('renderiza documento como card fixo e thumbnail não altera sua geometria', async () => {
    await renderMedia([attachment({ type: 'file', title: 'relatorio.pdf', subtitle: 'application/pdf', size: '2.4 MB', previewUrl: 'https://example.test/document-thumb.jpg' })]);
    expect(container.textContent).toContain('relatorio.pdf');
    expect(container.textContent).toContain('PDF · 2.4 MB');
    expect(container.querySelector('button[title="Baixar arquivo"]')).toBeTruthy();
    const card = container.querySelector('.max-w-\\[360px\\]') as HTMLElement;
    const thumbnail = card.querySelector('img') as HTMLImageElement;
    expect(thumbnail.parentElement?.className).toContain('h-14');
    expect(thumbnail.getAttribute('loading')).toBe('lazy');
    const before = card.className;
    await act(async () => thumbnail.dispatchEvent(new Event('load')));
    expect(card.className).toBe(before);
  });
});
