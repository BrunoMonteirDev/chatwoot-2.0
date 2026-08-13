import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Sparkles, Search } from 'lucide-react';
import { QuickResponse } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quickResponses: QuickResponse[];
  onSaveResponses: (responses: QuickResponse[]) => void;
  isDarkMode?: boolean;
}

const CUSTOM_FIELDS = [
  { tag: '{nome_contato}', label: 'Nome do Contato' },
  { tag: '{telefone}', label: 'Telefone' },
  { tag: '{empresa}', label: 'Empresa' },
  { tag: '{protocolo}', label: 'Protocolo' },
  { tag: '{data}', label: 'Data Atual' },
  { tag: '{atendente}', label: 'Atendente' },
];

export const QuickResponsesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  quickResponses,
  onSaveResponses,
  isDarkMode = false,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('Atendimento');
  const [searchFilter, setSearchFilter] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  if (!isOpen) return null;

  const handleStartAdd = () => {
    setEditingId(null);
    setShortcut('');
    setMessage('');
    setCategory('Atendimento');
    setIsAddingNew(true);
  };

  const handleStartEdit = (qr: QuickResponse) => {
    setIsAddingNew(false);
    setEditingId(qr.id);
    setShortcut(qr.shortcut);
    setMessage(qr.message);
    setCategory(qr.category || 'Atendimento');
  };

  const handleSaveItem = () => {
    if (!shortcut.trim() || !message.trim()) return;

    const formattedShortcut = shortcut.trim().replace(/^\//, ''); // strip leading slash if user typed it

    if (isAddingNew) {
      const newItem: QuickResponse = {
        id: `qr_${Date.now()}`,
        shortcut: formattedShortcut,
        message: message.trim(),
        category: category.trim() || 'Geral',
      };
      onSaveResponses([...quickResponses, newItem]);
    } else if (editingId) {
      const updated = quickResponses.map((item) =>
        item.id === editingId
          ? {
              ...item,
              shortcut: formattedShortcut,
              message: message.trim(),
              category: category.trim() || 'Geral',
            }
          : item
      );
      onSaveResponses(updated);
    }

    // Reset form
    setIsAddingNew(false);
    setEditingId(null);
    setShortcut('');
    setMessage('');
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta resposta rápida?')) {
      const updated = quickResponses.filter((item) => item.id !== id);
      onSaveResponses(updated);
      if (editingId === id) {
        setEditingId(null);
        setIsAddingNew(false);
      }
    }
  };

  const insertTag = (tag: string) => {
    setMessage((prev) => `${prev} ${tag}`.trim());
  };

  const filteredItems = quickResponses.filter((qr) => {
    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      qr.shortcut.toLowerCase().includes(query) ||
      qr.message.toLowerCase().includes(query) ||
      (qr.category && qr.category.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border ${
          isDarkMode
            ? 'bg-[#111b21] border-[#222d34] text-[#e9edef]'
            : 'bg-white border-[#d1d7db] text-[#111b21]'
        }`}
      >
        {/* Header */}
        <div
          className={`h-14 px-6 flex items-center justify-between border-b shrink-0 ${
            isDarkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-[#d1d7db]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[#00a884]" />
            <h2 className="font-semibold text-lg">Gerenciar Respostas Rápidas</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-[#2a3942] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top action / search bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div
              className={`flex items-center flex-1 rounded-lg px-3 h-10 border transition-colors ${
                isDarkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-[#d1d7db]'
              }`}
            >
              <Search className="w-4 h-4 text-[#8696a0] mr-2 shrink-0" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Pesquisar atalho ou campo personalizado..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#8696a0]"
              />
              {searchFilter && (
                <button onClick={() => setSearchFilter('')} className="text-[#8696a0] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={handleStartAdd}
              className="h-10 px-4 rounded-lg bg-[#00a884] hover:bg-[#008069] text-white text-sm font-medium flex items-center justify-center space-x-2 transition-colors shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Resposta</span>
            </button>
          </div>

          {/* Form for adding/editing */}
          {(isAddingNew || editingId) && (
            <div
              className={`p-5 rounded-xl border space-y-4 animate-in slide-in-from-top-2 duration-200 ${
                isDarkMode ? 'bg-[#202c33]/70 border-[#00a884]/40' : 'bg-[#f8f9fa] border-[#00a884]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-[#00a884]">
                  {isAddingNew ? 'Cadastrar Nova Resposta Rápida' : 'Editar Resposta Rápida'}
                </h3>
                <button
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingId(null);
                  }}
                  className="text-xs text-[#8696a0] hover:underline"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#8696a0] mb-1">
                    Atalho (ex: /obrigado ou pix) *
                  </label>
                  <div
                    className={`flex items-center rounded-lg px-3 h-10 border ${
                      isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
                    }`}
                  >
                    <span className="text-[#00a884] font-bold mr-1">/</span>
                    <input
                      type="text"
                      value={shortcut}
                      onChange={(e) => setShortcut(e.target.value)}
                      placeholder="atalho"
                      className="w-full bg-transparent text-sm outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#8696a0] mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="ex: Atendimento, Financeiro..."
                    className={`w-full rounded-lg px-3 h-10 text-sm border outline-none ${
                      isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1">
                  Mensagem Completa *
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escreva a resposta rápida que será inserida ao utilizar o atalho..."
                  className={`w-full rounded-lg p-3 text-sm border outline-none resize-none ${
                    isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
                  }`}
                />
              </div>

              {/* Custom fields / Tags suggestions */}
              <div>
                <label className="block text-xs font-medium text-[#8696a0] mb-1.5">
                  Campos Personalizados (clique para inserir no texto):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOM_FIELDS.map((cf) => (
                    <button
                      key={cf.tag}
                      type="button"
                      onClick={() => insertTag(cf.tag)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'bg-[#111b21] hover:bg-[#202c33] border-[#222d34] text-[#00a884]'
                          : 'bg-white hover:bg-[#f0f2f5] border-[#d1d7db] text-[#008069]'
                      }`}
                      title={`Inserir ${cf.label}`}
                    >
                      + {cf.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingId(null);
                  }}
                  className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-[#2a3942] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  disabled={!shortcut.trim() || !message.trim()}
                  className="px-5 h-9 rounded-lg bg-[#00a884] hover:bg-[#008069] disabled:opacity-50 text-white text-sm font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Resposta</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Responses List */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8696a0]">
              Respostas Cadastradas ({filteredItems.length})
            </h3>

            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#8696a0]">
                Nenhuma resposta rápida encontrada.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {filteredItems.map((qr) => (
                  <div
                    key={qr.id}
                    className={`p-3.5 rounded-xl border flex items-start justify-between space-x-4 transition-all ${
                      isDarkMode
                        ? 'bg-[#202c33] border-[#222d34] hover:border-[#00a884]/40'
                        : 'bg-[#f0f2f5] border-[#d1d7db] hover:border-[#00a884]/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-sm text-[#00a884]">/{qr.shortcut}</span>
                        {qr.category && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              isDarkMode
                                ? 'bg-[#111b21] text-[#8696a0]'
                                : 'bg-white text-[#54656f] border border-[#d1d7db]'
                            }`}
                          >
                            {qr.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs line-clamp-2 leading-relaxed opacity-90">{qr.message}</p>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0 pt-0.5">
                      <button
                        onClick={() => handleStartEdit(qr)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'hover:bg-[#2a3942] text-[#aebac1]'
                            : 'hover:bg-[#e9edef] text-[#54656f]'
                        }`}
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(qr.id)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isDarkMode
                            ? 'hover:bg-[#f15c6d]/20 text-[#f15c6d]'
                            : 'hover:bg-[#f15c6d]/10 text-[#f15c6d]'
                        }`}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
