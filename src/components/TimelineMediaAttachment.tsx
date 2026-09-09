import React, { useState } from 'react';
import type { Attachment } from '../types';
import { mediaFrame } from '../features/messages/mediaLayout';

interface Props {
  attachment: Attachment;
  isDarkMode: boolean;
  onImageClick(url: string, title?: string, subtitle?: string): void;
  onDimensionsResolved?(attachmentId: string, width: number, height: number): void;
}

const stableDimensions = (width: number, height: number) => Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;

export const TimelineMediaAttachment: React.FC<Props> = ({ attachment, isDarkMode, onImageClick, onDimensionsResolved }) => {
  // The initial frame is deliberately immutable. A legacy attachment decoded
  // now keeps its fallback frame for this mount; learned dimensions are used
  // from RAM/IndexedDB the next time it is rendered, avoiding an onLoad shift.
  const [frame] = useState(() => mediaFrame(attachment));
  const [loaded, setLoaded] = useState(false);
  const hasDimensions = frame.source === 'attachment';
  const remember = (width: number, height: number) => {
    if (!hasDimensions && stableDimensions(width, height)) onDimensionsResolved?.(attachment.id, width, height);
  };
  const frameStyle: React.CSSProperties = { width: frame.width, aspectRatio: frame.aspectRatio };
  const mediaClassName = `absolute inset-0 h-full w-full ${hasDimensions ? 'object-contain' : 'object-scale-down'}`;

  if (attachment.type === 'image') return (
    <div
      data-media-frame={attachment.id}
      data-media-source={frame.source}
      className={`relative inline-flex max-w-full overflow-hidden rounded-md align-top group/img cursor-pointer ${isDarkMode ? 'bg-black/20' : 'bg-black/5'}`}
      style={frameStyle}
      onClick={() => onImageClick(attachment.url, attachment.title, attachment.subtitle)}
    >
      {!loaded && <div aria-label="Carregando imagem" className="absolute inset-0 animate-pulse bg-[#8696a0]/15" />}
      <img
        src={attachment.url}
        alt={attachment.title || 'Attachment'}
        width={attachment.width}
        height={attachment.height}
        loading="lazy"
        className={`${mediaClassName} transition-transform duration-200 group-hover/img:scale-102`}
        referrerPolicy="no-referrer"
        onLoad={event => { setLoaded(true); remember(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight); }}
      />
    </div>
  );

  return (
    <div data-media-frame={attachment.id} data-media-source={frame.source} className="relative inline-flex max-w-full overflow-hidden rounded-md bg-black align-top" style={frameStyle}>
      {!loaded && <div aria-label="Carregando vídeo" className="absolute inset-0 animate-pulse bg-[#8696a0]/15" />}
      <video
        controls
        preload="metadata"
        poster={attachment.previewUrl}
        width={attachment.width}
        height={attachment.height}
        className={mediaClassName}
        src={attachment.url}
        onLoadedMetadata={event => { setLoaded(true); remember(event.currentTarget.videoWidth, event.currentTarget.videoHeight); }}
      >Seu navegador não suporta vídeo.</video>
    </div>
  );
};
