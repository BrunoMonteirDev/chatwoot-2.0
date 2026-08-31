import React from 'react';
import { Camera, FileText, Image, Mic, X } from 'lucide-react';

type AttachmentOption = 'image' | 'document' | 'audio' | 'camera';

interface Props {
  onSelectOption: (type: AttachmentOption) => void;
  onClose: () => void;
}

const options: Array<{ id: AttachmentOption; label: string; icon: typeof FileText; color: string }> = [
  { id: 'document', label: 'Documento', icon: FileText, color: 'text-[#8b5cf6]' },
  { id: 'image', label: 'Fotos e vídeos', icon: Image, color: 'text-[#00a884]' },
  { id: 'camera', label: 'Câmera', icon: Camera, color: 'text-[#ec4899]' },
  { id: 'audio', label: 'Áudio', icon: Mic, color: 'text-[#38bdf8]' },
];

const mobileOptions: Array<{ id: AttachmentOption; label: string; icon: typeof FileText; color: string }> = [
  { id: 'image', label: 'Fotos', icon: Image, color: 'text-[#00a884]' },
  { id: 'document', label: 'Arquivos', icon: FileText, color: 'text-[#8b5cf6]' },
  { id: 'camera', label: 'Câmera', icon: Camera, color: 'text-[#ec4899]' },
];

export const AttachmentMenu: React.FC<Props> = ({ onSelectOption, onClose }) => {
  const choose = (option: AttachmentOption) => {
    onSelectOption(option);
    onClose();
  };

  return (
    <>
      <button type="button" aria-label="Fechar anexos" className="fixed inset-0 z-40 hidden cursor-default md:block" onMouseDown={onClose} />
      <div className="absolute bottom-16 left-2 z-50 hidden min-w-[180px] flex-col space-y-1 rounded-2xl border border-[#d1d7db] bg-white p-2 shadow-xl md:flex" onClick={(event) => event.stopPropagation()}>
        {options.map((option) => {
          const Icon = option.icon;
          return <button key={option.id} type="button" onClick={() => choose(option.id)} className="flex items-center space-x-3 rounded-xl px-3 py-2 text-left hover:bg-[#f0f2f5]">
            <Icon className={`h-5 w-5 ${option.color}`} />
            <span className="text-sm font-medium text-[#111b21]">{option.label}</span>
          </button>;
        })}
      </div>

      <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Anexar conteúdo">
        <button type="button" aria-label="Fechar anexos" className="absolute inset-0 bg-black/55 backdrop-blur-[1px]" onClick={onClose} />
        <section className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-[#2a3942] bg-[#111b21] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 text-[#e9edef] shadow-2xl">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[#8696a0]" />
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Anexar</h2><p className="text-xs text-[#8696a0]">Escolha o que deseja enviar</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-[#aebac1] hover:bg-white/10"><X className="h-5 w-5" /></button></div>
          <div className="grid grid-cols-3 gap-x-3">
            {mobileOptions.map((option) => {
              const Icon = option.icon;
              return <button key={option.id} type="button" onClick={() => choose(option.id)} className="flex flex-col items-center gap-2 rounded-xl py-1 text-center active:scale-95"><span className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a3942] bg-[#202c33] ${option.color}`}><Icon className="h-6 w-6" /></span><span className="text-[11px] font-medium text-[#c7d1d8]">{option.label}</span></button>;
            })}
          </div>
        </section>
      </div>
    </>
  );
};
