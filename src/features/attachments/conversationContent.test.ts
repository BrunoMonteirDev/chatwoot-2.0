import { describe, expect, it } from 'vitest';
import { contentGroups } from './conversationContent';

describe('conversation content', () => it('separates media, documents and loaded-message links', () => {
  const attachments = [{ id: 1, kind: 'image', url: '/a', thumbnailUrl: null, title: null, size: null, createdAt: 1 }, { id: 2, kind: 'file', url: '/b', thumbnailUrl: null, title: 'a.pdf', size: 2, createdAt: 1 }] as any;
  expect(contentGroups(attachments, [{ text: 'Veja https://example.test/a e https://example.test/a' }] as any)).toMatchObject({ media: [{ id: 1 }], documents: [{ id: 2 }], links: ['https://example.test/a'] });
}));
