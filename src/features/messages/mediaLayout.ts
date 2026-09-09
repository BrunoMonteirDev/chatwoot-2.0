import type { Attachment } from '../../types';

export interface MediaDimensions { width: number; height: number }
export interface MediaViewport { width: number; height: number; mobile: boolean }
export interface MediaFrame extends MediaDimensions { aspectRatio: string; source: 'attachment' | 'fallback' }

const validDimension = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export const attachmentDimensions = (attachment: Pick<Attachment, 'width' | 'height'>): MediaDimensions | null => (
  validDimension(attachment.width) && validDimension(attachment.height)
    ? { width: attachment.width, height: attachment.height }
    : null
);

export const currentMediaViewport = (): MediaViewport => {
  const width = globalThis.window?.visualViewport?.width || globalThis.window?.innerWidth || 1024;
  const height = globalThis.window?.visualViewport?.height || globalThis.window?.innerHeight || 768;
  return { width, height, mobile: width < 768 };
};

export const fittedMediaDimensions = (dimensions: MediaDimensions, viewport: MediaViewport): MediaDimensions => {
  const maxWidth = viewport.mobile ? viewport.width * 0.9 : 460;
  const maxHeight = viewport.mobile ? viewport.height * 0.62 : Math.min(580, viewport.height * 0.65);
  const scale = Math.min(1, maxWidth / dimensions.width, maxHeight / dimensions.height);
  return { width: Math.max(1, Math.round(dimensions.width * scale)), height: Math.max(1, Math.round(dimensions.height * scale)) };
};

export const mediaFrame = (attachment: Pick<Attachment, 'type' | 'width' | 'height'>, viewport = currentMediaViewport()): MediaFrame => {
  const known = attachmentDimensions(attachment);
  const source = known ? 'attachment' : 'fallback';
  const original = known || (attachment.type === 'video' ? { width: 320, height: 180 } : { width: 320, height: 240 });
  const fitted = fittedMediaDimensions(original, viewport);
  return { ...fitted, aspectRatio: `${original.width} / ${original.height}`, source };
};
