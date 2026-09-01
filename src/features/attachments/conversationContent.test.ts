import { describe, expect, it } from 'vitest';
import { attachmentsWithinDates, contentGroups } from './conversationContent';

describe('conversation content', () => it('separates media, documents and loaded-message links', () => {
  const attachments = [{ id: 1, kind: 'image', url: '/a', thumbnailUrl: null, title: null, size: null, createdAt: 1 }, { id: 2, kind: 'file', url: '/b', thumbnailUrl: null, title: 'a.pdf', size: 2, createdAt: 1 }] as any;
  expect(contentGroups(attachments, [{ text: 'Veja https://example.test/a e https://example.test/a' }] as any)).toMatchObject({ media: [{ id: 1 }], documents: [{ id: 2 }], links: ['https://example.test/a'] });
}));

it('filters attachments by their sent date inclusively', () => {
  const attachments = [{ id: 1, createdAt: 1_704_067_200 }, { id: 2, createdAt: 1_704_164_400 }] as any;
  expect(attachmentsWithinDates(attachments, '2024-01-02', '2024-01-02').map(item => item.id)).toEqual([2]);
});
