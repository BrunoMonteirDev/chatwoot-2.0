// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { documentPresentation, downloadNameForAttachment, filesFromTransfer, hasFilesInTransfer, isBackdropClick, isEscapeKey, triggerAttachmentDownload } from './fileUtils';

describe('attachment file utilities', () => {
  const image = new File(['image'], 'foto original.png', { type: 'image/png' });

  it('extrai os mesmos arquivos para drag & drop e paste', () => {
    expect(filesFromTransfer({ files: [image] } as unknown as DataTransfer)).toEqual([image]);
    expect(filesFromTransfer({ files: [], items: [{ kind: 'file', getAsFile: () => image }] } as unknown as DataTransfer)).toEqual([image]);
    expect(hasFilesInTransfer({ types: ['Files'] } as unknown as DataTransfer)).toBe(true);
  });

  it('preserva o nome original ao calcular o download', () => {
    expect(downloadNameForAttachment('proposta final.pdf', 'https://cdn.test/blob')).toBe('proposta final.pdf');
    expect(downloadNameForAttachment(undefined, 'https://cdn.test/uploads/foto%20original.png')).toBe('foto original.png');
  });

  it('dispara download sem mudar a extensão para SVG', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    triggerAttachmentDownload('https://cdn.test/uploads/foto.png', 'foto.png');
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('identifica o tipo visual do documento', () => {
    expect(documentPresentation('relatorio.pdf', 'application/pdf')).toEqual({ kind: 'pdf', label: 'PDF' });
    expect(documentPresentation('dados.xlsx')).toEqual({ kind: 'spreadsheet', label: 'Planilha' });
    expect(documentPresentation('backup.zip')).toEqual({ kind: 'archive', label: 'Arquivo compactado' });
  });

  it('reconhece click no backdrop e a tecla Escape para fechar previews', () => {
    const backdrop = {};
    expect(isBackdropClick(backdrop, backdrop)).toBe(true);
    expect(isBackdropClick({}, backdrop)).toBe(false);
    expect(isEscapeKey('Escape')).toBe(true);
  });
});
