import React, { useState } from 'react';
import {
  CircleDashed,
  Plus,
  X,
  ChevronRight,
  Eye,
  VolumeX,
  Copy,
  MessageSquare,
  Trash2,
  Share2,
} from 'lucide-react';
import { StatusItem } from '../types';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { ToastContainer, ToastMessage } from './Toast';

interface Props {
  statuses: StatusItem[];
  onClose: () => void;
}

export const StatusView: React.FC<Props> = ({ statuses: initialStatuses, onClose }) => {
  const [statusList, setStatusList] = useState<StatusItem[]>(initialStatuses);
  const [activeStory, setActiveStory] = useState<StatusItem | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { menuState, openContextMenu, closeContextMenu } = useContextMenu();

  const addToast = (title: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleStatusContextMenu = (e: React.MouseEvent, st: StatusItem) => {
    const items: ContextMenuItem[] = [
      {
        label: 'Visualizar Status',
        icon: <Eye />,
        action: () => {
          setActiveStory(st);
          addToast(`Exibindo status de ${st.userName}`, 'info');
        },
      },
      {
        label: 'Responder ao Status',
        icon: <MessageSquare />,
        action: () => addToast(`Preparando resposta para ${st.userName}`, 'info'),
      },
      {
        label: 'Silenciar Atualizações',
        icon: <VolumeX />,
        action: () => addToast(`Status de ${st.userName} silenciado.`),
      },
      {
        label: 'Copiar Nome do Contato',
        icon: <Copy />,
        action: () => {
          navigator.clipboard.writeText(st.userName);
          addToast('Nome do contato copiado!');
        },
      },
      {
        label: 'Compartilhar Status',
        icon: <Share2 />,
        action: () => {
          navigator.clipboard.writeText(`Status de ${st.userName} (${st.time})`);
          addToast('Link do status copiado!');
        },
      },
      { divider: true, label: '' },
      {
        label: 'Ocultar do Feed',
        icon: <Trash2 />,
        danger: true,
        action: () => {
          setStatusList((prev) => prev.filter((item) => item.id !== st.id));
          if (activeStory?.id === st.id) setActiveStory(null);
          addToast(`Status de ${st.userName} ocultado do feed`, 'error');
        },
      },
    ];

    openContextMenu(e, items, `Status: ${st.userName}`);
  };

  return (
    <div className="flex-1 flex h-full bg-white text-[#111b21] z-20">
      {/* Left List Pane */}
      <div className="w-full md:w-[380px] bg-white border-r border-[#d1d7db] flex flex-col h-full select-none">
        <div className="h-16 px-4 bg-[#f0f2f5] flex items-center justify-between border-b border-[#d1d7db]">
          <h2 className="text-lg font-bold text-[#111b21]">Status</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-[#e9edef] flex items-center justify-center text-[#54656f] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* My Status Item */}
          <div className="flex items-center space-x-3 p-2 hover:bg-[#f0f2f5] rounded-lg cursor-pointer">
            <div className="relative w-12 h-12">
              <img
                src={statusList[0]?.userAvatar}
                alt="Meu status"
                className="w-12 h-12 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-[#00a884] rounded-full flex items-center justify-center text-white ring-2 ring-white">
                <Plus className="w-3 h-3 stroke-[3]" />
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm text-[#111b21]">Meu status</p>
              <p className="text-xs text-[#667781]">
                Clique para atualizar seu status
              </p>
            </div>
          </div>

          <div className="text-xs font-semibold text-[#008069] uppercase tracking-wider px-2">
            Recentes
          </div>

          {statusList.slice(1).map((st) => (
            <div
              key={st.id}
              onClick={() => setActiveStory(st)}
              onContextMenu={(e) => handleStatusContextMenu(e, st)}
              className="flex items-center space-x-3 p-2 hover:bg-[#f0f2f5] rounded-lg cursor-pointer transition-colors"
            >
              <div className="w-12 h-12 rounded-full ring-2 ring-[#00a884] p-0.5 overflow-hidden">
                <img
                  src={st.userAvatar}
                  alt={st.userName}
                  className="w-full h-full rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#111b21] truncate">
                  {st.userName}
                </p>
                <p className="text-xs text-[#667781]">{st.time}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#667781]" />
            </div>
          ))}
        </div>
      </div>

      {/* Right Story Display / Placeholder */}
      <div className="hidden md:flex flex-1 bg-[#f0f2f5] flex-col items-center justify-center relative p-8">
        {activeStory ? (
          <div className="max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-xl border border-[#d1d7db] flex flex-col h-[520px] relative">
            <div className="h-1 bg-gray-200 w-full flex space-x-1 px-2 pt-2">
              <div className="h-1 bg-[#00a884] flex-1 rounded-full animate-pulse" />
            </div>
            <div className="p-4 flex items-center space-x-3 border-b border-[#f0f2f5]">
              <img
                src={activeStory.userAvatar}
                alt={activeStory.userName}
                className="w-10 h-10 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="font-bold text-sm text-[#111b21]">
                  {activeStory.userName}
                </p>
                <p className="text-xs text-[#667781]">{activeStory.time}</p>
              </div>
            </div>

            <div className="flex-1 bg-[#008069] flex items-center justify-center p-8 text-center text-lg font-medium text-white">
              {activeStory.stories[0]?.type === 'image' ? (
                <img
                  src={activeStory.stories[0].content}
                  alt="Story"
                  className="max-h-full max-w-full rounded"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <p>{activeStory.stories[0]?.content}</p>
              )}
            </div>

            {activeStory.stories[0]?.caption && (
              <div className="p-3 bg-white text-xs text-center text-[#111b21]">
                {activeStory.stories[0].caption}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-[#667781] space-y-3 max-w-sm">
            <CircleDashed className="w-16 h-16 mx-auto text-[#00a884] opacity-80" />
            <h3 className="text-lg font-medium text-[#111b21]">
              Clique em um contato para ver o status
            </h3>
            <p className="text-xs">
              Compartilhe textos, fotos, vídeos e GIFs que somem em 24 horas.
            </p>
          </div>
        )}
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
