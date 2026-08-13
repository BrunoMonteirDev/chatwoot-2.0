import React from 'react';
import { FileText, Image, Camera, User, BarChart2, Paintbrush, Mic } from 'lucide-react';

interface Props {
  onSelectOption: (type: 'image' | 'document' | 'audio' | 'camera' | 'contact' | 'poll') => void;
  onClose: () => void;
}

export const AttachmentMenu: React.FC<Props> = ({ onSelectOption, onClose }) => {
  const options = [
    { id: 'document', label: 'Documento', icon: FileText, color: 'bg-[#5157AE]' },
    { id: 'audio', label: 'Arquivo de áudio', icon: Mic, color: 'bg-[#00a884]' },
    { id: 'image', label: 'Fotos e vídeos', icon: Image, color: 'bg-[#007bfc]' },
    { id: 'camera', label: 'Câmera', icon: Camera, color: 'bg-[#EC407A]' },
    { id: 'contact', label: 'Contato', icon: User, color: 'bg-[#009de2]' },
    { id: 'poll', label: 'Enquete', icon: BarChart2, color: 'bg-[#029D81]' },
    { id: 'drawing', label: 'Desenho', icon: Paintbrush, color: 'bg-[#E35D5B]' },
  ];

  return (
    <div
      className="absolute bottom-16 left-2 sm:left-4 max-w-[calc(100vw-1rem)] bg-white border border-[#d1d7db] rounded-2xl shadow-xl p-2 z-50 flex flex-col space-y-1 min-w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt) => {
        const IconComponent = opt.icon;
        return (
          <button
            key={opt.id}
            onClick={() => {
              onSelectOption(opt.id as any);
              onClose();
            }}
            className="flex items-center space-x-3 px-3 py-2 hover:bg-[#f0f2f5] rounded-xl transition-colors text-left"
          >
            <div className={`w-8 h-8 rounded-full ${opt.color} flex items-center justify-center text-white shadow-xs`}>
              <IconComponent className="w-4 h-4" />
            </div>
            <span className="text-sm text-[#111b21] font-medium">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
