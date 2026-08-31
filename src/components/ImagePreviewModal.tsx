import React, { useEffect, useState } from 'react';
import { X, ZoomIn, ZoomOut, Download, CornerUpRight } from 'lucide-react';
import { isBackdropClick, isEscapeKey, triggerAttachmentDownload } from '../features/attachments/fileUtils';

interface Props {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<Props> = ({ imageUrl, title, subtitle, onClose }) => {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.3, 0.5));

  const handleDownload = () => {
    triggerAttachmentDownload(imageUrl, title, 'imagem');
  };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (isEscapeKey(event.key)) onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0b141a]/90 backdrop-blur-xs flex flex-col animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="h-16 bg-[#111b21] px-6 flex items-center justify-between text-[#e9edef] border-b border-[#222d34]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#2563eb] flex items-center justify-center font-bold text-white">
            X
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title || 'Imagem em alta resolução'}</h3>
            {subtitle && <p className="text-xs text-[#8696a0]">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleZoomOut}
            title="Reduzir zoom"
            className="w-10 h-10 rounded-full hover:bg-[#202c33] flex items-center justify-center text-[#aebac1] hover:text-white transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomIn}
            title="Aumentar zoom"
            className="w-10 h-10 rounded-full hover:bg-[#202c33] flex items-center justify-center text-[#aebac1] hover:text-white transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownload}
            title="Baixar imagem"
            className="w-10 h-10 rounded-full hover:bg-[#202c33] flex items-center justify-center text-[#aebac1] hover:text-white transition-colors"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={() => alert('Mensagem encaminhada com sucesso!')}
            title="Encaminhar"
            className="w-10 h-10 rounded-full hover:bg-[#202c33] flex items-center justify-center text-[#aebac1] hover:text-white transition-colors"
          >
            <CornerUpRight className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            title="Fechar (Esc)"
            className="w-10 h-10 rounded-full hover:bg-[#202c33] flex items-center justify-center text-[#aebac1] hover:text-white transition-colors ml-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Display Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto relative" onMouseDown={(event) => { if (isBackdropClick(event.target, event.currentTarget)) onClose(); }}>
        <img
          src={imageUrl}
          alt={title || 'Preview'}
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-[#222d34]"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Bottom bar */}
      <div className="h-14 bg-[#111b21] px-6 flex items-center justify-center text-xs text-[#8696a0] border-t border-[#222d34]">
        <span>Clique no fundo para fechar • Zoom: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
};
