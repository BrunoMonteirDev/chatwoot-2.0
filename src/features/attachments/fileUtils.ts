export const filesFromTransfer = (transfer: Pick<DataTransfer, 'files' | 'items'> | null | undefined): File[] => {
  if (!transfer) return [];
  const direct = Array.from(transfer.files || []);
  if (direct.length) return direct;
  return Array.from(transfer.items || [])
    .filter((item) => item.kind === 'file')
    .flatMap((item) => {
      const file = item.getAsFile();
      return file ? [file] : [];
    });
};

export const hasFilesInTransfer = (transfer: Pick<DataTransfer, 'types'> | null | undefined) =>
  Boolean(transfer && Array.from(transfer.types || []).includes('Files'));

export const downloadNameForAttachment = (title: string | undefined, url: string, fallback = 'anexo') => {
  if (title?.trim()) return title.trim();
  try {
    const lastPathSegment = decodeURIComponent(new URL(url, window.location.href).pathname.split('/').filter(Boolean).pop() || '');
    if (lastPathSegment && !/^blob$/i.test(lastPathSegment)) return lastPathSegment;
  } catch {
    // Use the stable fallback when the provider returned a non-URL data value.
  }
  return fallback;
};

export const triggerAttachmentDownload = (url: string, title?: string, fallback?: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadNameForAttachment(title, url, fallback);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const documentPresentation = (title?: string, contentType?: string) => {
  const value = `${contentType || ''} ${title || ''}`.toLowerCase();
  if (value.includes('pdf')) return { kind: 'pdf' as const, label: 'PDF' };
  if (/spreadsheet|excel|csv|\.xlsx?\b|\.csv\b/.test(value)) return { kind: 'spreadsheet' as const, label: 'Planilha' };
  if (/zip|rar|7z|tar|compressed|\.zip\b|\.rar\b/.test(value)) return { kind: 'archive' as const, label: 'Arquivo compactado' };
  if (/word|document|\.docx?\b/.test(value)) return { kind: 'document' as const, label: 'Documento' };
  return { kind: 'file' as const, label: 'Arquivo' };
};

export const isBackdropClick = (target: EventTarget | null, currentTarget: EventTarget | null) => target === currentTarget;
export const isEscapeKey = (key: string) => key === 'Escape';
