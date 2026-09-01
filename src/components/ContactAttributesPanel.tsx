import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ArrowLeft,
  Phone,
  Video,
  UserPlus,
  Search,
  Star,
  Bell,
  Lock,
  Shield,
  Users,
  Check,
  ChevronRight,
  ChevronDown,
  Trash2,
  LogOut,
  Ban,
  ThumbsDown,
  MessageSquare,
  Share2,
  Edit2,
  Info,
  ExternalLink,
  GripVertical,
  Plus,
  FileText,
  Clock,
  Heart,
  FolderPlus,
  CircleDot,
  Building,
  User,
  Mail,
  AtSign,
  Calendar,
  Sliders,
  SlidersHorizontal,
  Key,
  Minus,
} from 'lucide-react';
import { Chat } from '../types';
import { groupMetadataClient, type GroupMetadata } from '../features/groups/metadata';
import { participantColor, participantPhone } from '../features/groups/participant';
import type { WhatsAppTransport } from '../integrations/whatsapp/provider';

interface GroupMember {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  avatarBg?: string;
  status?: string;
  isAdmin?: boolean;
  isMe?: boolean;
  website?: string;
}

interface Props {
  chat: Chat;
  allChats?: Chat[];
  onSelectChat?: (chat: Chat) => void;
  isDarkMode: boolean;
  onClose: () => void;
  activeTab?: 'contact' | 'attributes';
  conversationId?: number;
  inboxId?: number;
  groupTransport?: WhatsAppTransport | null;
}

export const ContactAttributesPanel: React.FC<Props> = ({
  chat,
  allChats = [],
  onSelectChat,
  isDarkMode,
  onClose,
  activeTab = 'contact',
  conversationId,
  inboxId,
  groupTransport,
}) => {
  const [currentTab, setCurrentTab] = useState<'contact' | 'attributes'>(activeTab);

  useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  // Accordion states for Attributes view
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isScheduledOpen, setIsScheduledOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(true);
  const [isAttributesOpen, setIsAttributesOpen] = useState(true);
  // Resizable panel width state
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('wa_contact_panel_width');
    return saved ? Math.max(300, Math.min(700, parseInt(saved, 10))) : 380;
  });
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  // Selected Group Member for "Dados do contato" nested panel
  const [selectedMemberContact, setSelectedMemberContact] = useState<GroupMember | null>(null);

  // Search filter inside group members list
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);

  // Toggle & input states
  const [isMuted, setIsMuted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(chat.favorite || false);

  // Notes state
  const [clientNotes, setClientNotes] = useState('Suporte prioritário White Label. Cliente VIP.');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Add Member Modal State
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  // Default Group Members list (for groups)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([
    {
      id: 'm1',
      name: 'Você',
      phone: '+55 11 99999-8888',
      status: 'Adicionar etiqueta de membro',
      isMe: true,
      avatarBg: '#2563eb',
    },
    {
      id: 'm2',
      name: '~Atendimento White Label',
      phone: '+55 11 5108-6616',
      status: 'Atendimento das 9h as 18h, segunda a sexta 🕶️',
      isAdmin: true,
      avatarBg: '#0284c7',
    },
    {
      id: 'm3',
      name: 'CWMKT White Label',
      phone: '+55 11 3322-1100',
      status: 'Suporte exclusivo https://cwmkt.com.br',
      isAdmin: true,
      website: 'https://cwmkt.com.br',
      avatarBg: '#10b981',
    },
    {
      id: 'm4',
      name: 'Ricardo Freitas',
      phone: '+55 11 98765-4321',
      status: 'Disponível para reuniões',
      avatarBg: '#8b5cf6',
    },
  ]);
  const [groupMetadata, setGroupMetadata] = useState<GroupMetadata | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  useEffect(() => {
    if (!chat.isGroup || !conversationId || !inboxId) return;
    let active = true;
    void groupMetadataClient.get(inboxId, conversationId, groupTransport).then(({ group }) => {
      if (!active) return;
      setGroupMetadata(group); setDescriptionDraft(group.description || '');
      setGroupMembers(group.participants.map(member => ({ id: member.jid, name: member.name || (member.jid.endsWith('@lid') ? 'Participante' : 'Sem nome'), phone: participantPhone(member.jid, member.phoneNumber), isAdmin: Boolean(member.admin), status: member.admin ? 'Administrador' : undefined, avatarBg: participantColor(member.jid) })));
    }).catch(error => { if (active) setGroupError(error instanceof Error ? error.message : 'Não foi possível carregar o grupo.'); });
    return () => { active = false; };
  }, [chat.isGroup, conversationId, inboxId, groupTransport]);

  const saveDescription = async () => {
    if (!conversationId || !inboxId || !groupMetadata?.transport) return;
    setSavingDescription(true); setGroupError(null);
    try { const { group } = await groupMetadataClient.updateDescription(inboxId, conversationId, groupMetadata.transport, descriptionDraft); setGroupMetadata(group); setDescriptionDraft(group.description || descriptionDraft); setEditingDescription(false); }
    catch (error) { setGroupError(error instanceof Error ? error.message : 'Não foi possível editar a descrição.'); }
    finally { setSavingDescription(false); }
  };

  useEffect(() => {
    localStorage.setItem('wa_contact_panel_width', String(panelWidth));
  }, [panelWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      if (newWidth >= 300 && newWidth <= 700) {
        setPanelWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const newMember: GroupMember = {
      id: `m-${Date.now()}`,
      name: newMemberName.trim(),
      phone: newMemberPhone.trim() || '+55 11 90000-0000',
      status: 'Membro adicionado',
      avatarBg: '#ec4899',
    };
    setGroupMembers((prev) => [...prev, newMember]);
    setNewMemberName('');
    setNewMemberPhone('');
    setShowAddMemberModal(false);
  };

  const filteredMembers = groupMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.phone.includes(memberSearchQuery)
  );

  // Active contact target for Contact Info mode
  const currentContactName = selectedMemberContact
    ? selectedMemberContact.name
    : chat.name;
  const currentContactPhone = selectedMemberContact
    ? selectedMemberContact.phone
    : chat.phone || '+55 11 5108-6616';

  // Compute common groups from allChats
  const commonGroups = allChats.filter((c) => c.isGroup && c.id !== chat.id);

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className={`h-full border-l flex flex-col z-30 shrink-0 select-none relative transition-all duration-75 ${
        isDarkMode
          ? 'bg-[#111b21] border-[#222d34] text-[#e9edef]'
          : 'bg-white border-[#d1d7db] text-[#111b21]'
      }`}
    >
      {/* Resizable Handle (Left Edge) */}
      <div
        onMouseDown={handleMouseDown}
        title="Arrastar para redimensionar painel"
        className={`absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center group transition-colors ${
          isResizing ? 'bg-[#00a884]' : 'hover:bg-[#00a884]/40'
        }`}
      >
        <div
          className={`w-1 h-8 rounded-full transition-colors flex items-center justify-center ${
            isResizing ? 'bg-white' : 'bg-[#8696a0]/40 group-hover:bg-[#00a884]'
          }`}
        >
          <GripVertical className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Top Header */}
      <div
        className={`h-14 px-3 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'bg-[#151717] border-[#1e1f1f]' : 'bg-[#f0f2f5] border-[#d1d7db]'
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          {selectedMemberContact ? (
            <button
              type="button"
              onClick={() => setSelectedMemberContact(null)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isDarkMode ? 'hover:bg-[#2a3942] text-[#8696a0]' : 'hover:bg-[#e9edef] text-[#54656f]'
              }`}
              title="Voltar para dados do grupo"
            >
              <ArrowLeft className="w-5 h-5 text-[#8696a0]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isDarkMode ? 'hover:bg-[#2a3942] text-[#8696a0]' : 'hover:bg-[#e9edef] text-[#54656f]'
              }`}
              title="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center space-x-2 truncate">
            {currentTab === 'attributes' ? (
              <>
                <div className="p-1 rounded bg-[#00a884]/20 text-[#00a884]">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm tracking-tight truncate text-[#e9edef]">
                  Contatos
                </h3>
              </>
            ) : (
              <h3 className="font-bold text-sm tracking-tight truncate">
                {selectedMemberContact
                  ? 'Dados do contato'
                  : chat.isGroup
                  ? 'Dados do grupo'
                  : 'Dados do contato'}
              </h3>
            )}
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className={`flex items-center p-0.5 rounded-lg border ${isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-gray-200 border-gray-300'}`}>
          <button
            type="button"
            onClick={() => {
              setCurrentTab('contact');
              setSelectedMemberContact(null);
            }}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              currentTab === 'contact'
                ? 'bg-[#00a884] text-white shadow-xs'
                : isDarkMode ? 'text-[#8696a0] hover:text-white' : 'text-gray-600 hover:text-black'
            }`}
          >
            Dados
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentTab('attributes');
              setSelectedMemberContact(null);
            }}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
              currentTab === 'attributes'
                ? 'bg-[#00a884] text-white shadow-xs'
                : isDarkMode ? 'text-[#8696a0] hover:text-white' : 'text-gray-600 hover:text-black'
            }`}
          >
            Atributos
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* ======================================================== */}
        {/* SCENARIO A: CRM ATTRIBUTES PANEL                          */}
        {/* ======================================================== */}
        {currentTab === 'attributes' && (
          <div className="p-4 space-y-4 pb-8">
            {/* 1. Contact Hero */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="relative">
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center bg-[#2563eb] border-2 border-[#00a884] shadow-lg text-white font-bold text-xl">
                  {chat.avatarType === 'image' && chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{chat.avatar || 'CT'}</span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#00a884] border-2 border-[#111b21]" />
              </div>

              <div>
                <h2 className="font-bold text-sm leading-tight text-[#00a884] flex items-center justify-center gap-1">
                  <span>✓</span> {chat.name === 'Suporte White Label' ? 'Meu numero: (você)' : chat.name} <span>✓</span>
                </h2>
                <div className="flex items-center justify-center gap-2 mt-1 text-[#8696a0]">
                  <Info className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                  <ExternalLink className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                </div>
              </div>
            </div>

            {/* 2. Contact Description Card */}
            <div className={`p-3.5 rounded-2xl border ${isDarkMode ? 'bg-[#182229]/60 border-[#222d34]' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-[#00a884] uppercase tracking-wider">
                  DESCRIÇÃO DO CONTATO
                </span>
                <button type="button" className="text-[#8696a0] hover:text-white p-1 cursor-pointer">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-[#aebac1] leading-relaxed">
                Descrição do contato: Cliente preferencial com atendimento prioritário e suporte ativo.
              </p>
            </div>

            {/* 3. Contact Details Fields */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#8696a0]">
                <div className="flex items-center space-x-2.5">
                  <Key className="w-4 h-4 text-[#00a884]" />
                  <span className="font-mono text-[#aebac1]">me</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <div className="flex items-center space-x-2.5 text-[#e9edef]">
                  <MessageSquare className="w-4 h-4 text-[#00a884]" />
                  <span>Canal WhatsApp Direct</span>
                </div>
                <Edit2 className="w-3.5 h-3.5 text-[#8696a0] hover:text-white cursor-pointer" />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <div className="flex items-center space-x-2.5 text-[#8696a0]">
                  <Mail className="w-4 h-4" />
                  <span>Indisponível</span>
                </div>
                <Edit2 className="w-3.5 h-3.5 text-[#8696a0] hover:text-white cursor-pointer" />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <div className="flex items-center space-x-2.5 text-[#8696a0]">
                  <Phone className="w-4 h-4" />
                  <span>Indisponível</span>
                </div>
                <Edit2 className="w-3.5 h-3.5 text-[#8696a0] hover:text-white cursor-pointer" />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <div className="flex items-center space-x-2.5 text-[#aebac1] font-mono text-[11px]">
                  <AtSign className="w-4 h-4 text-[#8696a0]" />
                  <span>{chat.phone ? `${chat.phone.replace(/\D/g, '')}@c.us` : '5511988887777@c.us'}</span>
                </div>
                <Edit2 className="w-3.5 h-3.5 text-[#8696a0] hover:text-white cursor-pointer" />
              </div>

              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <div className="flex items-center space-x-2.5 text-[#8696a0]">
                  <Building className="w-4 h-4" />
                  <span>Indisponível</span>
                </div>
                <Edit2 className="w-3.5 h-3.5 text-[#8696a0] hover:text-white cursor-pointer" />
              </div>
            </div>

            {/* 4. Row of 5 Quick Action Icon Buttons */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                  isDarkMode ? 'bg-[#182229] border-[#2a3942] hover:bg-[#202c33]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Conversar"
              >
                <MessageSquare className="w-4 h-4 text-[#00a884]" />
              </button>

              <button
                type="button"
                className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                  isDarkMode ? 'bg-[#182229] border-[#2a3942] hover:bg-[#202c33]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Editar"
              >
                <Edit2 className="w-4 h-4 text-[#8696a0]" />
              </button>

              <button
                type="button"
                className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                  isDarkMode ? 'bg-[#182229] border-[#2a3942] hover:bg-[#202c33]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Mensagens agendadas"
              >
                <Calendar className="w-4 h-4 text-[#8696a0]" />
              </button>

              <button
                type="button"
                className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                  isDarkMode ? 'bg-[#182229] border-[#2a3942] hover:bg-[#202c33]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Atributos"
              >
                <Sliders className="w-4 h-4 text-[#8696a0]" />
              </button>

              <button
                type="button"
                className={`flex-1 p-2.5 rounded-xl border border-red-500/20 bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer hover:bg-red-500/20`}
                title="Excluir"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>

            {/* 5. Accordions */}
            <div className="space-y-2 pt-2">
              {/* Accordion 1: Ações da conversa */}
              <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-[#182229]/40 border-[#222d34]' : 'bg-gray-50 border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsActionsOpen(!isActionsOpen)}
                  className="w-full px-3.5 py-3 flex items-center justify-between text-xs font-bold text-[#e9edef] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span>Ações da conversa</span>
                  <Plus className={`w-4 h-4 text-[#00a884] transition-transform ${isActionsOpen ? 'rotate-45' : ''}`} />
                </button>
                {isActionsOpen && (
                  <div className="p-3.5 pt-0 space-y-2 text-xs border-t border-white/5">
                    <button type="button" className="w-full text-left py-1.5 px-2 rounded hover:bg-white/5 text-[#aebac1] block">
                      • Agendar mensagem automatizada
                    </button>
                    <button type="button" className="w-full text-left py-1.5 px-2 rounded hover:bg-white/5 text-[#aebac1] block">
                      • Transferir atendimento para agente
                    </button>
                    <button type="button" className="w-full text-left py-1.5 px-2 rounded hover:bg-white/5 text-[#aebac1] block">
                      • Atribuir etiquetas
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 2: Mensagens Agendadas */}
              <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-[#182229]/40 border-[#222d34]' : 'bg-gray-50 border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsScheduledOpen(!isScheduledOpen)}
                  className="w-full px-3.5 py-3 flex items-center justify-between text-xs font-bold text-[#e9edef] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span>Mensagens Agendadas</span>
                  <Plus className={`w-4 h-4 text-[#00a884] transition-transform ${isScheduledOpen ? 'rotate-45' : ''}`} />
                </button>
                {isScheduledOpen && (
                  <div className="p-3.5 pt-0 text-xs text-[#8696a0] border-t border-white/5">
                    Nenhuma mensagem agendada no momento.
                  </div>
                )}
              </div>

              {/* Accordion 3: Informação da conversa */}
              <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-[#182229]/40 border-[#222d34]' : 'bg-gray-50 border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsInfoOpen(!isInfoOpen)}
                  className="w-full px-3.5 py-3 flex items-center justify-between text-xs font-bold text-[#e9edef] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span>Informação da conversa</span>
                  {isInfoOpen ? (
                    <Minus className="w-4 h-4 text-[#00a884]" />
                  ) : (
                    <Plus className="w-4 h-4 text-[#00a884]" />
                  )}
                </button>
                {isInfoOpen && (
                  <div className="p-3.5 pt-1 space-y-2 text-xs border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[#8696a0]">Atendente:</span>
                      <span className="font-semibold text-[#e9edef]">Você</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#8696a0]">Caixa de Entrada:</span>
                      <span className="font-semibold text-[#e9edef]">Canal Interno</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#8696a0]">Criado em:</span>
                      <span className="font-semibold text-[#e9edef]">31/07/2026 10:30</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 4: Atributos do contato */}
              <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-[#182229]/40 border-[#222d34]' : 'bg-gray-50 border-gray-200'}`}>
                <button
                  type="button"
                  onClick={() => setIsAttributesOpen(!isAttributesOpen)}
                  className="w-full px-3.5 py-3 flex items-center justify-between text-xs font-bold text-[#e9edef] hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span>Atributos do contato</span>
                  {isAttributesOpen ? (
                    <Minus className="w-4 h-4 text-[#00a884]" />
                  ) : (
                    <Plus className="w-4 h-4 text-[#00a884]" />
                  )}
                </button>
                {isAttributesOpen && (
                  <div className="p-3.5 pt-1 space-y-2 text-xs border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[#8696a0]">Plano:</span>
                      <span className="font-semibold text-[#e9edef]">Enterprise</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#8696a0]">Origem:</span>
                      <span className="font-semibold text-[#e9edef]">Google Ads</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#8696a0]">CPF/CNPJ:</span>
                      <span className="font-semibold text-[#e9edef]">123.456.789-00</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENARIO B: GROUP INFO PANEL ("Dados do grupo")           */}
        {/* ======================================================== */}
        {currentTab === 'contact' && chat.isGroup && !selectedMemberContact && (
          <div className="space-y-4 pb-8">
            {/* 1. Group Hero Avatar, Name & Subtitle */}
            <div className="flex flex-col items-center text-center p-5 border-b border-black/5 dark:border-white/5 space-y-2">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-[#0284c7] border-2 border-[#00a884] shadow-lg text-white font-bold text-2xl">
                  {chat.avatarType === 'image' && chat.avatar ? (
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{chat.avatar || 'TE'}</span>
                  )}
                </div>
              </div>

              <div className="mt-1">
                <h2 className="font-bold text-lg leading-tight px-2 break-words">
                  {chat.name}
                </h2>
                <p className="text-xs text-[#8696a0] mt-1 font-medium">
                  Grupo · <span className="text-[#00a884] font-semibold">{groupMembers.length} membros</span>
                </p>
                {groupError && <p className="mt-2 text-xs text-red-400">{groupError}</p>}
              </div>

              {/* Action Buttons below group name: Adicionar, Pesquisar */}
              <div className="flex items-center justify-center gap-4 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(true)}
                  className="flex flex-col items-center space-y-1 text-xs text-[#8696a0] hover:text-[#00a884] cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#e9edef] group-hover:bg-[#00a884] group-hover:text-white transition-colors">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <span className="text-[11px]">Adicionar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSearchingMembers((prev) => !prev)}
                  className="flex flex-col items-center space-y-1 text-xs text-[#8696a0] hover:text-[#00a884] cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#e9edef] group-hover:bg-[#00a884] group-hover:text-white transition-colors">
                    <Search className="w-4 h-4" />
                  </div>
                  <span className="text-[11px]">Pesquisar</span>
                </button>
              </div>
            </div>

            <div className="border-b border-black/5 p-4 dark:border-white/5">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold text-[#8696a0]">Descrição</span>{groupMetadata?.canEditDescription && !editingDescription && <button type="button" onClick={() => setEditingDescription(true)} className="text-xs font-semibold text-[#00a884]">Editar descrição</button>}</div>
              {editingDescription ? <><textarea value={descriptionDraft} onChange={event => setDescriptionDraft(event.target.value)} className={`min-h-20 w-full rounded-lg border p-2 text-xs ${isDarkMode ? 'border-[#2a3942] bg-[#202c33]' : 'border-[#d1d7db] bg-white'}`} /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setEditingDescription(false)} className="text-xs">Cancelar</button><button type="button" disabled={savingDescription} onClick={() => void saveDescription()} className="text-xs font-semibold text-[#00a884]">{savingDescription ? 'Salvando…' : 'Salvar'}</button></div></> : <p className="whitespace-pre-wrap text-xs text-[#8696a0]">{groupMetadata?.description || 'Sem descrição.'}</p>}
            </div>

            {/* 2. Media, links e docs Preview */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-semibold">
                  <FileText className="w-4 h-4 text-[#8696a0]" />
                  <span>Mídia, links e docs</span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-[#8696a0]">
                  <span className="font-mono">113</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* Media Thumbnails Grid */}
              <div className="grid grid-cols-4 gap-2">
                <div className="h-16 rounded-lg bg-black/20 dark:bg-white/10 overflow-hidden relative cursor-pointer border border-white/5 hover:opacity-80 transition-opacity">
                  <img
                    src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=200&q=80"
                    alt="Media 1"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="h-16 rounded-lg bg-black/20 dark:bg-white/10 overflow-hidden relative cursor-pointer border border-white/5 hover:opacity-80 transition-opacity">
                  <img
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=200&q=80"
                    alt="Media 2"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="h-16 rounded-lg bg-black/40 overflow-hidden relative cursor-pointer border border-white/5 flex items-center justify-center text-white text-[10px] font-bold">
                  <div className="absolute inset-0 bg-black/50" />
                  <span className="relative z-10">▶ 0:41</span>
                </div>
                <div className="h-16 rounded-lg bg-[#202c33] p-1.5 flex flex-col justify-between border border-white/5 cursor-pointer">
                  <div className="w-5 h-5 rounded bg-red-500 text-white flex items-center justify-center text-[8px] font-black">
                    PDF
                  </div>
                  <span className="text-[9px] text-[#8696a0] truncate font-mono">
                    manual.pdf
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Settings & Features List */}
            <div className="space-y-1 py-1 border-b border-black/5 dark:border-white/5">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 text-[#e9edef]">
                  <Star className="w-4 h-4 text-[#8696a0]" />
                  <span>Mensagens favoritas</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8696a0]" />
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 text-[#e9edef]">
                  <Bell className="w-4 h-4 text-[#8696a0]" />
                  <span>Configurações de notificação</span>
                </div>
                <div
                  className={`w-8 h-4 rounded-full transition-colors p-0.5 ${
                    isMuted ? 'bg-[#00a884]' : 'bg-[#374248]'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      isMuted ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>

              <div className="px-4 py-3 flex items-start space-x-3 text-xs">
                <Lock className="w-4 h-4 text-[#8696a0] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#e9edef]">Criptografia</p>
                  <p className="text-[11px] text-[#8696a0] leading-relaxed mt-0.5">
                    As mensagens são protegidas com a criptografia de ponta a ponta. Clique para saber mais.
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 flex items-start space-x-3 text-xs">
                <Shield className="w-4 h-4 text-[#8696a0] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#e9edef]">Privacidade avançada da conversa</p>
                  <p className="text-[11px] text-[#8696a0] mt-0.5">Desativada</p>
                </div>
              </div>

              <button
                type="button"
                className="w-full px-4 py-3 flex items-center space-x-3 text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-[#e9edef]"
              >
                <Users className="w-4 h-4 text-[#8696a0]" />
                <div className="text-left">
                  <p className="font-semibold">Create a similar group</p>
                  <p className="text-[11px] text-[#8696a0]">
                    Comece com os mesmos membros. Você poderá adicionar ou remover os membros que desejar.
                  </p>
                </div>
              </button>
            </div>

            {/* 4. Group Members List Section */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8696a0]">
                  {groupMembers.length} membros
                </span>
                <button
                  type="button"
                  onClick={() => setIsSearchingMembers(!isSearchingMembers)}
                  className="p-1 rounded hover:bg-white/10 text-[#8696a0] transition-colors cursor-pointer"
                  title="Pesquisar membros"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Optional Search Input */}
              {isSearchingMembers && (
                <div className="mb-2">
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Pesquisar membro..."
                    className={`w-full px-3 py-1.5 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-gray-50 border-gray-300'
                    }`}
                    autoFocus
                  />
                </div>
              )}

              {/* Members Cards */}
              <div className="space-y-1">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => setSelectedMemberContact(member)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-[#202c33] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: member.avatarBg || '#2563eb' }}
                      >
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          member.name.substring(0, 2).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1">
                          <span className="font-semibold text-xs text-[#e9edef] truncate">
                            {member.name}
                          </span>
                          {member.website && (
                            <span className="text-emerald-400 text-[10px]">✓</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8696a0] truncate mt-0.5">
                          {member.status || member.phone}
                        </p>
                      </div>
                    </div>

                    {/* Admin Badge */}
                    {member.isAdmin && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#202c33] border border-[#2a3942] text-[#8696a0] shrink-0 ml-2">
                        Admin do grupo
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Group Actions Footer */}
            <div className="p-4 space-y-1 border-t border-black/5 dark:border-white/5 text-xs">
              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#e9edef] flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-[#8696a0]" />
                <span>Mostrar mudanças de membros</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#e9edef] flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : 'text-[#8696a0]'}`} />
                <span>{isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#e9edef] flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-[#8696a0]" />
                <span>Adicionar à lista</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-red-500/10 text-red-500 font-semibold flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <CircleDot className="w-4 h-4" />
                <span>Limpar conversa</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-red-500/10 text-red-500 font-semibold flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair do grupo</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SCENARIO B: CONTACT INFO PANEL ("Dados do contato")       */}
        {/* ======================================================== */}
        {currentTab === 'contact' && (!chat.isGroup || selectedMemberContact) && (
          <div className="space-y-4 pb-8">
            {/* 1. Contact Cover & Hero Header */}
            <div className="flex flex-col items-center text-center p-5 border-b border-black/5 dark:border-white/5 space-y-2">
              <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center bg-[#2563eb] border-2 border-[#00a884] shadow-lg text-white font-bold text-2xl">
                {selectedMemberContact ? (
                  selectedMemberContact.avatar ? (
                    <img
                      src={selectedMemberContact.avatar}
                      alt={selectedMemberContact.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{selectedMemberContact.name.substring(0, 2).toUpperCase()}</span>
                  )
                ) : chat.avatarType === 'image' && chat.avatar ? (
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{chat.avatar || 'CT'}</span>
                )}
              </div>

              <div className="mt-1">
                <h2 className="font-bold text-lg leading-tight break-words">
                  {currentContactName}
                </h2>
                <p className="text-xs font-mono text-[#8696a0] mt-1">
                  {currentContactPhone}
                </p>
                <p className="text-[11px] text-[#8696a0] mt-0.5">
                  Outras empresas · <span className="text-emerald-400 font-semibold">Aberta 24 horas</span>
                </p>
              </div>

              {/* 3 Circular Action Buttons: Conversar, Adicionar, Compartilhar */}
              <div className="flex items-center justify-center gap-5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectChat) {
                      const match = allChats.find(
                        (c) => c.name.toLowerCase() === currentContactName.toLowerCase()
                      );
                      if (match) onSelectChat(match);
                    }
                  }}
                  className="flex flex-col items-center space-y-1 text-xs text-[#8696a0] hover:text-[#00a884] cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#e9edef] group-hover:bg-[#00a884] group-hover:text-white transition-colors">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="text-[11px]">Conversar</span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center space-y-1 text-xs text-[#8696a0] hover:text-[#00a884] cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#e9edef] group-hover:bg-[#00a884] group-hover:text-white transition-colors">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <span className="text-[11px]">Adicionar</span>
                </button>

                <button
                  type="button"
                  className="flex flex-col items-center space-y-1 text-xs text-[#8696a0] hover:text-[#00a884] cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#e9edef] group-hover:bg-[#00a884] group-hover:text-white transition-colors">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <span className="text-[11px]">Compartilhar</span>
                </button>
              </div>
            </div>

            {/* 2. Client Notes Section */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">
                  Notas sobre o cliente
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingNotes(!isEditingNotes)}
                  className="p-1 rounded hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors cursor-pointer"
                  title={isEditingNotes ? 'Salvar notas' : 'Editar notas'}
                >
                  {isEditingNotes ? <Check className="w-4 h-4 text-[#00a884]" /> : <Edit2 className="w-4 h-4" />}
                </button>
              </div>

              {isEditingNotes ? (
                <textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  rows={3}
                  className={`w-full p-2.5 rounded-xl border text-xs outline-none resize-none ${
                    isDarkMode ? 'bg-[#202c33] border-[#00a884] text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                  placeholder="Adicione notas sobre seu cliente..."
                />
              ) : (
                <p className="text-xs text-[#e9edef] bg-black/5 dark:bg-white/5 p-3 rounded-xl leading-relaxed">
                  {clientNotes}
                </p>
              )}
            </div>

            {/* 3. Business Details Box */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3 text-xs">
              <div className="flex items-center space-x-2 text-[#8696a0]">
                <Building className="w-4 h-4 shrink-0 text-[#00a884]" />
                <span className="font-semibold text-[#e9edef]">Conta comercial</span>
                <Info className="w-3.5 h-3.5" />
              </div>

              <div className="space-y-1.5 pl-6">
                <p className="text-[#e9edef] font-medium">
                  Suporte exclusivo clientes White Label 🛠️
                </p>
                <p className="text-[#8696a0]">
                  <span className="text-emerald-400 font-bold">Aberta agora</span> · Aberta 24 horas ∨
                </p>
                <a
                  href="https://cwmkt.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00a884] hover:underline font-semibold block pt-0.5"
                >
                  https://cwmkt.com.br
                </a>
              </div>
            </div>

            {/* 4. Media, links e docs */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <div className="flex items-center space-x-3">
                <FileText className="w-4 h-4 text-[#8696a0]" />
                <span className="text-[#e9edef]">Mídia, links e docs</span>
              </div>
              <div className="flex items-center space-x-1 text-[#8696a0]">
                <span className="font-mono">0</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* 5. Starred, Notifications, Privacy & Security */}
            <div className="space-y-1 py-1 border-b border-black/5 dark:border-white/5 text-xs">
              <button
                type="button"
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 text-[#e9edef]">
                  <Star className="w-4 h-4 text-[#8696a0]" />
                  <span>Mensagens favoritas</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#8696a0]" />
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-3 text-[#e9edef]">
                  <Bell className="w-4 h-4 text-[#8696a0]" />
                  <span>Silenciar notificações</span>
                </div>
                <div
                  className={`w-8 h-4 rounded-full transition-colors p-0.5 ${
                    isMuted ? 'bg-[#00a884]' : 'bg-[#374248]'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      isMuted ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>

              <div className="px-4 py-3 flex items-start space-x-3">
                <Shield className="w-4 h-4 text-[#8696a0] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#e9edef]">Privacidade avançada da conversa</p>
                  <p className="text-[11px] text-[#8696a0] mt-0.5">Desativada</p>
                </div>
              </div>

              <div className="px-4 py-3 flex items-start space-x-3">
                <Lock className="w-4 h-4 text-[#8696a0] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#e9edef]">Segurança</p>
                  <p className="text-[11px] text-[#8696a0] leading-relaxed mt-0.5">
                    Sua empresa usa um serviço seguro da Meta para gerenciar esta conversa. Clique para saber mais.
                  </p>
                </div>
              </div>
            </div>

            {/* 6. Recado e Número de Telefone */}
            <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-2 text-xs">
              <span className="font-bold text-[#8696a0] uppercase tracking-wider text-[11px]">
                Recado e número de telefone
              </span>

              <div className="space-y-1 pt-1">
                <p className="text-[#e9edef]">
                  Atendimento das 9h as 18h, segunda a sexta 🕶️
                </p>
                <p className="text-[#8696a0] font-mono">{currentContactPhone}</p>
              </div>
            </div>

            {/* 7. Groups in Common (rendered dynamically if any exist) */}
            {commonGroups.length > 0 && (
              <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3 text-xs">
                <span className="font-bold text-[#8696a0]">
                  {commonGroups.length} {commonGroups.length === 1 ? 'grupo em comum' : 'grupos em comum'}
                </span>

                <div className="space-y-2">
                  {commonGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => {
                        if (onSelectChat) {
                          onSelectChat(group);
                          onClose();
                        }
                      }}
                      className="flex items-center space-x-3 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#0284c7] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                        {group.avatarType === 'image' && group.avatar ? (
                          <img src={group.avatar} alt={group.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{group.avatar || group.name.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#e9edef] truncate group-hover:text-[#00a884] transition-colors">
                          {group.name}
                        </p>
                        <p className="text-[11px] text-[#8696a0] truncate">
                          {group.about || 'Grupo em comum'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Contact Action Options */}
            <div className="p-4 space-y-1 text-xs">
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#e9edef] flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-current' : 'text-[#8696a0]'}`} />
                <span>{isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#e9edef] flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-[#8696a0]" />
                <span>Adicionar à lista</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-red-500/10 text-red-500 font-semibold flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <CircleDot className="w-4 h-4" />
                <span>Limpar conversa</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-red-500/10 text-red-500 font-semibold flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                <span>Bloquear {currentContactPhone}</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-red-500/10 text-red-500 font-semibold flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <ThumbsDown className="w-4 h-4" />
                <span>Denunciar empresa</span>
              </button>

              <button
                type="button"
                className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-red-500/10 text-red-500 font-semibold flex items-center space-x-3 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Apagar conversa</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl shadow-2xl border p-5 space-y-4 animate-in fade-in zoom-in-95 ${
              isDarkMode ? 'bg-[#182228] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-bold text-sm">Adicionar Membro ao Grupo</h3>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#8696a0] uppercase mb-1">
                  Nome do Participante
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className={`w-full px-3 py-2 rounded-xl border outline-none ${
                    isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#8696a0] uppercase mb-1">
                  Telefone (WhatsApp)
                </label>
                <input
                  type="text"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  placeholder="Ex: +55 11 98888-7777"
                  className={`w-full px-3 py-2 rounded-xl border outline-none ${
                    isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-gray-50 border-gray-300'
                  }`}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-3 py-2 rounded-xl bg-gray-500/20 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
