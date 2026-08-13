import React, { useState } from 'react';
import { Users, X, Check, Search, AlertTriangle } from 'lucide-react';
import { Chat } from '../types';

interface Props {
  chats: Chat[];
  onCreateGroup: (
    groupName: string,
    description: string,
    channelName: string,
    selectedContactIds: string[]
  ) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

const UNOFFICIAL_GROUP_CHANNELS = [
  'grupo.kopla (API Não Oficial)',
  'WhatsApp Não Oficial - Baileys API',
  'WhatsApp Web Multi-Device (Não Oficial)',
];

export const NewGroupModal: React.FC<Props> = ({
  chats,
  onCreateGroup,
  onClose,
  isDarkMode = false,
}) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [channelName, setChannelName] = useState('grupo.kopla (API Não Oficial)');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const validContacts = chats.filter((c) => c.id !== 'me' && !c.isGroup);

  const filteredContacts = validContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const toggleSelectContact = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    onCreateGroup(groupName.trim(), description.trim(), channelName, selectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div
        className={`w-full max-w-lg rounded-2xl shadow-2xl border flex flex-col overflow-hidden max-h-[90vh] ${
          isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${
            isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Criar Novo Grupo (API Não Oficial)</h2>
              <p className="text-xs text-[#8696a0]">Recurso exclusivo para canais de API Não Oficial</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-white/10 text-[#8696a0] hover:text-white' : 'hover:bg-black/10 text-[#54656f]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Warning Notice Banner regarding WhatsApp Official and other inboxes */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-start space-x-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Restrição de Conectividade</p>
              <p className="text-[11px] opacity-90 leading-relaxed">
                Grupos são suportados <strong>exclusivamente por APIs Não Oficiais</strong>. WhatsApp Oficial, Instagram, Messenger e E-mail não possuem o recurso de grupos de mensagens.
              </p>
            </div>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-xs font-bold text-[#00a884] uppercase tracking-wider mb-1.5">
              Nome do Grupo *
            </label>
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ex: Suporte VIP Kopla, Grupo de Vendas..."
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                isDarkMode
                  ? 'bg-[#202c33] border-[#2a3942] focus:border-[#00a884] text-white placeholder-[#8696a0]'
                  : 'bg-gray-50 border-gray-300 focus:border-[#00a884] text-[#111b21] placeholder-gray-400'
              }`}
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider mb-1.5">
              Descrição / Links do Grupo
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Digite a descrição, links do CRM ou observações..."
              className={`w-full p-3 rounded-xl border text-xs outline-none resize-none transition-colors ${
                isDarkMode
                  ? 'bg-[#202c33] border-[#2a3942] focus:border-[#00a884] text-white placeholder-[#8696a0]'
                  : 'bg-gray-50 border-gray-300 focus:border-[#00a884] text-[#111b21] placeholder-gray-400'
              }`}
            />
          </div>

          {/* Unofficial Channel Selection */}
          <div>
            <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider mb-1.5">
              Canal de Conectividade (Apenas API Não Oficial)
            </label>
            <select
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-xs font-semibold outline-none cursor-pointer ${
                isDarkMode
                  ? 'bg-[#202c33] border-[#2a3942] text-emerald-400'
                  : 'bg-gray-50 border-gray-300 text-emerald-700'
              }`}
            >
              {UNOFFICIAL_GROUP_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[#8696a0] mt-1">
              Canais WhatsApp Oficial e redes sociais não suportam criação de grupo.
            </p>
          </div>

          {/* Participants Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">
                Adicionar Participantes ({selectedIds.length})
              </label>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-[#00a884] hover:underline cursor-pointer"
                >
                  Limpar seleção
                </button>
              )}
            </div>

            {/* Search Input for Participants */}
            <div
              className={`flex items-center rounded-xl h-9 px-3 border mb-2 ${
                isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-gray-100 border-gray-200'
              }`}
            >
              <Search className="w-3.5 h-3.5 text-[#8696a0] mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar participante por nome ou número..."
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>

            {/* Contact List */}
            <div
              className={`max-h-40 overflow-y-auto rounded-xl border p-1 space-y-1 ${
                isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
              }`}
            >
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => {
                  const isSelected = selectedIds.includes(contact.id);
                  return (
                    <div
                      key={contact.id}
                      onClick={() => toggleSelectContact(contact.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-[#00a884]/20 text-white'
                            : 'bg-[#00a884]/10 text-black'
                          : isDarkMode
                          ? 'hover:bg-white/5 text-[#aebac1]'
                          : 'hover:bg-black/5 text-[#54656f]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {contact.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-white/90">{contact.name}</p>
                          <p className="text-[10px] text-[#8696a0] truncate">{contact.phone || contact.about}</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[#00a884] border-[#00a884] text-white'
                            : isDarkMode
                            ? 'border-[#2a3942]'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="p-3 text-center text-xs text-[#8696a0]">Nenhum contato encontrado</p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                isDarkMode
                  ? 'border-[#2a3942] text-[#aebac1] hover:bg-white/5'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!groupName.trim()}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Users className="w-4 h-4" />
              <span>Criar Grupo (API Não Oficial)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
