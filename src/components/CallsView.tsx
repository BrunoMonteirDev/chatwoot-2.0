import React, { useState } from 'react';
import {
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  X,
  Copy,
  Trash2,
  History,
  Share2,
} from 'lucide-react';
import { CallLog } from '../types';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { ToastContainer, ToastMessage } from './Toast';

interface Props {
  calls: CallLog[];
  onClose: () => void;
}

export const CallsView: React.FC<Props> = ({ calls: initialCalls, onClose }) => {
  const [callList, setCallList] = useState<CallLog[]>(initialCalls);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { menuState, openContextMenu, closeContextMenu } = useContextMenu();

  const addToast = (title: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCallContextMenu = (e: React.MouseEvent, call: CallLog) => {
    const items: ContextMenuItem[] = [
      {
        label: call.isVideo ? 'Iniciar Chamada de Vídeo' : 'Retornar Chamada de Voz',
        icon: call.isVideo ? <Video /> : <Phone />,
        action: () => addToast(`Iniciando chamada para ${call.name}...`, 'info'),
      },
      {
        label: 'Copiar Nome do Contato',
        icon: <Copy />,
        action: () => {
          navigator.clipboard.writeText(call.name);
          addToast('Nome do contato copiado!');
        },
      },
      {
        label: 'Histórico de Ligações',
        icon: <History />,
        action: () => addToast(`Exibindo histórico de ligações com ${call.name}`, 'info'),
      },
      {
        label: 'Compartilhar Registro',
        icon: <Share2 />,
        action: () => {
          navigator.clipboard.writeText(`Registro de Chamada: ${call.name} - ${call.time}`);
          addToast('Registro copiado para compartilhamento!');
        },
      },
      { divider: true, label: '' },
      {
        label: 'Remover do Histórico',
        icon: <Trash2 />,
        danger: true,
        action: () => {
          setCallList((prev) => prev.filter((c) => c.id !== call.id));
          addToast(`Registro de chamada com ${call.name} removido!`, 'error');
        },
      },
    ];

    openContextMenu(e, items, `Registro: ${call.name}`);
  };

  return (
    <div className="flex-1 flex h-full bg-white text-[#111b21] z-20">
      <div className="w-full md:w-[380px] bg-white border-r border-[#d1d7db] flex flex-col h-full">
        <div className="h-16 px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-[#d1d7db]">
          <h2 className="text-lg font-bold text-[#111b21]">Chamadas</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-[#e9edef] flex items-center justify-center text-[#54656f] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 pb-24 md:pb-2 space-y-1 select-none">
          {callList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8696a0]">
              Nenhum registro no histórico de chamadas.
            </div>
          ) : (
            callList.map((call) => (
              <div
                key={call.id}
                onContextMenu={(e) => handleCallContextMenu(e, call)}
                className="flex items-center space-x-3 p-3 hover:bg-[#f0f2f5] rounded-lg cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-[#2563eb] flex items-center justify-center font-bold text-white overflow-hidden">
                  {call.avatar ? (
                    <img
                      src={call.avatar}
                      alt={call.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    call.name.substring(0, 2)
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#111b21] truncate">
                    {call.name}
                  </p>
                  <div className="flex items-center space-x-1 text-xs text-[#667781]">
                    {call.type === 'incoming' && (
                      <PhoneIncoming className="w-3.5 h-3.5 text-[#00a884]" />
                    )}
                    {call.type === 'outgoing' && (
                      <PhoneOutgoing className="w-3.5 h-3.5 text-[#00a884]" />
                    )}
                    {call.type === 'missed' && (
                      <PhoneMissed className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span>{call.time}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addToast(`Iniciando chamada com ${call.name}...`, 'info');
                  }}
                  className="w-9 h-9 rounded-full hover:bg-[#e9edef] flex items-center justify-center text-[#00a884] cursor-pointer"
                >
                  {call.isVideo ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <Phone className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="hidden md:flex flex-1 bg-[#f0f2f5] flex-col items-center justify-center p-8 text-center text-[#667781]">
        <Phone className="w-16 h-16 text-[#00a884] opacity-80 mb-4" />
        <h3 className="text-lg font-medium text-[#111b21] mb-1">
          Histórico de Chamadas
        </h3>
        <p className="text-xs max-w-sm">
          Faça chamadas de voz e vídeo com criptografia de ponta a ponta
          diretamente do navegador.
        </p>
      </div>

      <ContextMenu
        x={menuState.x}
        y={menuState.y}
        isOpen={menuState.isOpen}
        onClose={closeContextMenu}
        items={menuState.items}
        title={menuState.title}
        isDarkMode={false}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={removeToast}
        isDarkMode={false}
      />
    </div>
  );
};
