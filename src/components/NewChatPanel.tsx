import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  UserPlus,
  User,
  Check,
  Phone,
  Mail,
  Paperclip,
  Lock,
  Globe,
  Mic,
  X,
  FileText,
  Image as ImageIcon,
  Send,
  MessageSquare,
  Sparkles,
  History,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  Clock,
  Tag,
  Edit3,
  Save,
  StickyNote,
  Trash2,
  FileSpreadsheet,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { Chat, Attachment } from '../types';
import {
  WhatsappOficialIcon,
  WhatsappIcon,
  InstagramIcon,
  MessengerIcon,
} from './ChannelIcons';

interface Props {
  chats: Chat[];
  onSelectChat: (chat: Chat) => void;
  onCreateNewChat: (
    name: string,
    phone: string,
    channelName: string,
    initialMessageText?: string,
    isPrivate?: boolean,
    attachments?: Attachment[]
  ) => void;
  onUpdateContact?: (chatId: string, updates: Partial<Chat>) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

const AVAILABLE_CHANNELS = [
  { id: 'Whatsapp Oficial(1420)', name: 'Whatsapp Oficial(1420)', type: 'wa_official' },
  { id: 'whatsapp Oficial(7221)', name: 'whatsapp Oficial(7221)', type: 'wa_official' },
  { id: 'Whatsapp Oficial(9491)', name: 'Whatsapp Oficial(9491)', type: 'wa_official' },
  { id: 'grupo.kopla', name: 'grupo.kopla', type: 'instagram' },
  { id: 'Kopla Sistemas', name: 'Kopla Sistemas', type: 'messenger' },
];

export const NewChatPanel: React.FC<Props> = ({
  chats,
  onSelectChat,
  onCreateNewChat,
  onUpdateContact,
  onClose,
  isDarkMode = false,
}) => {
  // Search query
  const [query, setQuery] = useState('');

  // Currently active or editing contact
  const [selectedContact, setSelectedContact] = useState<Chat | null>(
    chats.length > 0 && chats[0].id !== 'me' ? chats[0] : null
  );

  // Form Fields
  const [contactName, setContactName] = useState('');
  const [ddi, setDdi] = useState('55');
  const [ddd, setDdd] = useState('');
  const [phoneNum, setPhoneNum] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactDescription, setContactDescription] = useState('');
  const [notesList, setNotesList] = useState<{ id: string; text: string; date: string; author?: string }[]>([]);
  const [newNoteInput, setNewNoteInput] = useState('');

  // Feedback Toast
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // New Chat Setup State
  const [selectedChannel, setSelectedChannel] = useState<string>('Whatsapp Oficial(1420)');
  const [initialText, setInitialText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAudioAttached, setIsAudioAttached] = useState(false);

  // Is creating brand new contact mode
  const [isNewContactMode, setIsNewContactMode] = useState(false);

  // Mobile View state: 'list' | 'detail'
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Active Tab View: 'info' | 'conversas' | 'nova' | 'notas' | 'todos'
  const [activeTab, setActiveTab] = useState<'info' | 'conversas' | 'nova' | 'notas' | 'todos'>('info');

  // Synchronize form when selectedContact changes
  useEffect(() => {
    if (selectedContact) {
      setIsNewContactMode(false);
      setContactName(selectedContact.name || '');
      
      // Parse DDI / DDD / Number if possible
      const rawPhone = (selectedContact.phone || selectedContact.about || '').replace(/\D/g, '');
      if (rawPhone.length >= 10) {
        if (rawPhone.startsWith('55') && rawPhone.length >= 12) {
          setDdi('55');
          setDdd(rawPhone.slice(2, 4));
          setPhoneNum(rawPhone.slice(4));
        } else {
          setDdi('55');
          setDdd(rawPhone.slice(0, 2));
          setPhoneNum(rawPhone.slice(2));
        }
      } else {
        setDdi('55');
        setDdd('11');
        setPhoneNum(rawPhone);
      }

      setContactEmail(selectedContact.email || '');
      setContactDescription(selectedContact.description || selectedContact.about || '');
      setNotesList(selectedContact.notes || []);
      if (selectedContact.channelName) {
        setSelectedChannel(selectedContact.channelName);
      }
    } else {
      handlePrepareNewContact();
    }
  }, [selectedContact]);

  // Phone mask formatting
  const handlePhoneNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    let formatted = raw;
    if (raw.length > 5) {
      formatted = `${raw.slice(0, 5)}-${raw.slice(5, 9)}`;
    }
    setPhoneNum(formatted);
  };

  const rawDdi = ddi.replace(/\D/g, '') || '55';
  const rawDdd = ddd.replace(/\D/g, '');
  const rawNum = phoneNum.replace(/\D/g, '');
  const fullPhoneFormatted = `+${rawDdi} ${rawDdd ? `(${rawDdd}) ` : ''}${phoneNum}`;
  const fullPhoneRaw = `+${rawDdi}${rawDdd}${rawNum}`;

  // Switch to blank "New Contact" form
  const handlePrepareNewContact = () => {
    setIsNewContactMode(true);
    setSelectedContact(null);
    setContactName('');
    setDdi('55');
    setDdd('');
    setPhoneNum('');
    setContactEmail('');
    setContactDescription('');
    setNotesList([]);
    setInitialText('');
    setAttachments([]);
    setMobileView('detail');
  };

  // Add a new note
  const handleAddNote = () => {
    if (!newNoteInput.trim()) return;
    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const newNote = {
      id: `note-${Date.now()}`,
      text: newNoteInput.trim(),
      date: formattedDate,
      author: 'Você',
    };
    const updatedNotes = [newNote, ...notesList];
    setNotesList(updatedNotes);
    setNewNoteInput('');

    // If editing existing contact, save notes directly
    if (selectedContact && onUpdateContact) {
      onUpdateContact(selectedContact.id, { notes: updatedNotes });
    }
  };

  // Remove a note
  const handleRemoveNote = (noteId: string) => {
    const updatedNotes = notesList.filter((n) => n.id !== noteId);
    setNotesList(updatedNotes);
    if (selectedContact && onUpdateContact) {
      onUpdateContact(selectedContact.id, { notes: updatedNotes });
    }
  };

  // Save Contact Changes
  const handleSaveContactDetails = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!contactName.trim()) return;

    if (selectedContact && onUpdateContact && !isNewContactMode) {
      onUpdateContact(selectedContact.id, {
        name: contactName.trim(),
        phone: fullPhoneFormatted,
        about: contactDescription.trim() || fullPhoneFormatted,
        email: contactEmail.trim(),
        description: contactDescription.trim(),
        notes: notesList,
      });
      setSaveSuccessMessage('Informações do contato salvas com sucesso!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } else {
      // New Contact creation
      const finalPhone = fullPhoneRaw || fullPhoneFormatted;
      onCreateNewChat(
        contactName.trim() || 'Novo Contato',
        finalPhone,
        selectedChannel,
        undefined,
        false,
        undefined
      );
      setSaveSuccessMessage('Contato e dados salvos com sucesso!');
      setIsNewContactMode(false);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    }
  };

  // Attachment Simulation Handlers
  const handleAddImageAttachment = () => {
    const sampleImg: Attachment = {
      id: `att-${Date.now()}`,
      type: 'image',
      url: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80',
      title: 'imagem_anexa.jpg',
      size: '1.2 MB',
    };
    setAttachments((prev) => [...prev, sampleImg]);
  };

  const handleAddFileAttachment = () => {
    const sampleDoc: Attachment = {
      id: `att-${Date.now()}`,
      type: 'file',
      url: '#',
      title: 'documento_proposta.pdf',
      size: '340 KB',
      pages: '2 páginas',
    };
    setAttachments((prev) => [...prev, sampleDoc]);
  };

  const handleToggleAudio = () => {
    if (isAudioAttached) {
      setIsAudioAttached(false);
      setAttachments((prev) => prev.filter((a) => a.type !== 'audio'));
    } else {
      setIsAudioAttached(true);
      const audioAtt: Attachment = {
        id: `audio-${Date.now()}`,
        type: 'audio',
        url: '#',
        title: 'Mensagem de voz (0:15)',
        size: '120 KB',
      };
      setAttachments((prev) => [...prev, audioAtt]);
    }
  };

  // Final Action: Create / Start Conversation
  const handleFinalStartConversation = () => {
    const finalPhone = fullPhoneRaw || fullPhoneFormatted;

    if (isNewContactMode || !selectedContact) {
      onCreateNewChat(
        contactName.trim() || 'Novo Contato',
        finalPhone,
        selectedChannel,
        initialText.trim() || undefined,
        isPrivate,
        attachments.length > 0 ? attachments : undefined
      );
    } else {
      // Update contact details first if edited
      if (onUpdateContact) {
        onUpdateContact(selectedContact.id, {
          name: contactName.trim(),
          phone: fullPhoneFormatted,
          email: contactEmail.trim(),
          description: contactDescription.trim(),
          notes: notesList,
          channelName: selectedChannel,
        });
      }
      
      // If an initial text or attachment was entered, create new message or chat
      onCreateNewChat(
        contactName.trim() || selectedContact.name,
        finalPhone || selectedContact.phone || selectedContact.about || '',
        selectedChannel,
        initialText.trim() || undefined,
        isPrivate,
        attachments.length > 0 ? attachments : undefined
      );
    }
    onClose();
  };

  // Filter contacts list
  const filteredChats = chats.filter((c) => {
    if (c.id === 'me') return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.about && c.about.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  // Previous conversations matching this contact
  const previousChatsList = selectedContact
    ? chats.filter(
        (c) =>
          c.id === selectedContact.id ||
          c.name.toLowerCase() === selectedContact.name.toLowerCase() ||
          (selectedContact.phone && c.phone === selectedContact.phone)
      )
    : [];

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors select-text ${
        isDarkMode ? 'bg-[#0b141a] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
      }`}
    >
      {/* Top Header Bar */}
      <div
        className={`h-16 px-3 sm:px-6 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-white border-[#d1d7db]'
        }`}
      >
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              isDarkMode
                ? 'hover:bg-[#2a3942] text-[#aebac1]'
                : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Voltar para Conversas"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold hidden sm:inline">Voltar</span>
          </button>

          {mobileView === 'detail' && (
            <button
              onClick={() => setMobileView('list')}
              className={`md:hidden px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors ${
                isDarkMode ? 'bg-[#2a3942] text-white' : 'bg-[#e9edef] text-[#111b21]'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Contatos</span>
            </button>
          )}

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block" />

          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-sm sm:text-lg leading-tight flex items-center gap-1.5 truncate">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-[#00a884] shrink-0" />
              <span className="truncate">Gerenciador de Contatos</span>
            </h1>
            <p className="text-xs text-[#8696a0] truncate hidden sm:block">
              Cadastre, edite informações do contato, adicione notas e inicie conversas.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={handlePrepareNewContact}
            className="px-3 sm:px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Cadastrar Novo</span>
            <span className="sm:hidden">Novo</span>
          </button>

          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isDarkMode ? 'text-[#aebac1] hover:bg-[#2a3942]' : 'text-[#54656f] hover:bg-[#e9edef]'
            }`}
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Save Toast Notification */}
      {saveSuccessMessage && (
        <div className="bg-[#00a884] text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-center space-x-2 shadow-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main Two-Column Full-Screen Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* LEFT PANEL: CONTACT DIRECTORY & SEARCH */}
        <div
          className={`w-full md:w-[380px] lg:w-[420px] ${
            mobileView === 'detail' ? 'hidden md:flex' : 'flex'
          } flex-col h-full shrink-0 border-r ${
            isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
          }`}
        >
          {/* Search Box */}
          <div className={`p-3 sm:p-4 border-b ${isDarkMode ? 'border-[#222d34]' : 'border-[#d1d7db]'}`}>
            <div
              className={`flex items-center rounded-xl h-10 px-3.5 border transition-colors ${
                isDarkMode
                  ? 'bg-[#202c33] border-transparent focus-within:border-[#00a884]'
                  : 'bg-[#f0f2f5] border-transparent focus-within:border-[#00a884]'
              }`}
            >
              <Search className="w-4 h-4 text-[#8696a0] mr-2 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar nome, telefone ou e-mail..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#8696a0]"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-[#8696a0] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <button
              onClick={handlePrepareNewContact}
              className={`w-full flex items-center space-x-3.5 p-3 rounded-xl border border-dashed transition-all cursor-pointer mb-3 ${
                isNewContactMode
                  ? 'border-[#00a884] bg-[#00a884]/10 text-[#00a884] font-bold'
                  : isDarkMode
                  ? 'border-[#2a3942] hover:bg-[#202c33] text-[#aebac1]'
                  : 'border-[#d1d7db] hover:bg-[#f0f2f5] text-[#54656f]'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-bold truncate">➕ Cadastrar Novo Contato</p>
                <p className="text-xs text-[#8696a0] truncate">DDI + DDD + Número</p>
              </div>
            </button>

            {filteredChats.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8696a0]">
                Nenhum contato cadastrado encontrado.
              </div>
            ) : (
              filteredChats.map((c) => {
                const isSelected = selectedContact?.id === c.id && !isNewContactMode;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedContact(c);
                      setMobileView('detail');
                    }}
                    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? isDarkMode
                          ? 'bg-[#202c33] border-l-4 border-[#00a884]'
                          : 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                        : isDarkMode
                        ? 'hover:bg-[#202c33]/60'
                        : 'hover:bg-[#f0f2f5]'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-[#0284c7] text-white font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                      {c.avatarType === 'image' && c.avatar ? (
                        <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{c.name.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[#00a884]' : ''}`}>
                          {c.name}
                        </p>
                        {c.notes && c.notes.length > 0 && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-500 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <StickyNote className="w-3 h-3" /> {c.notes.length}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8696a0] font-mono truncate">
                        {c.phone || c.about || 'Sem telefone'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT MAIN PANEL: FULL CONTACT EDITOR & CHAT CREATOR */}
        <div
          className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 ${
            mobileView === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Section A: Contact Header Profile Banner */}
          <div
            className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs ${
              isDarkMode ? 'bg-[#202c33] border-[#2b3942]' : 'bg-white border-[#e9edef]'
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-[#00a884] text-white font-extrabold text-xl flex items-center justify-center shadow-md">
                {contactName.trim()
                  ? contactName.trim().substring(0, 2).toUpperCase()
                  : 'NC'}
              </div>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span>{contactName.trim() || 'Novo Contato Sem Nome'}</span>
                  {isNewContactMode && (
                    <span className="text-xs bg-[#00a884]/20 text-[#00a884] font-semibold px-2.5 py-0.5 rounded-full">
                      Novo Cadastro
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[#8696a0] font-mono mt-1">
                  {fullPhoneFormatted}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => handleSaveContactDetails()}
                disabled={!contactName.trim()}
                className="px-4 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-40"
              >
                <Save className="w-4 h-4" />
                <span>{isNewContactMode ? 'Salvar Novo Contato' : 'Salvar Dados do Contato'}</span>
              </button>
            </div>
          </div>

          {/* Section B: Tab Navigation Bar (Exact model requested) */}
          <div className="flex flex-col gap-2">
            <div
              className={`w-full rounded-xl border-2 overflow-hidden shadow-xs transition-colors ${
                isDarkMode
                  ? 'bg-[#202c33] border-[#374248]'
                  : 'bg-white border-black'
              }`}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-y-2 md:divide-y-0 divide-black/80 dark:divide-gray-700">
                <button
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className={`py-3.5 px-4 text-center text-sm font-semibold transition-all cursor-pointer select-none ${
                    activeTab === 'info'
                      ? 'bg-[#00a884] text-white font-bold'
                      : isDarkMode
                      ? 'text-[#e9edef] hover:bg-[#2a3942]'
                      : 'text-black hover:bg-gray-100'
                  }`}
                >
                  Informações
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('conversas')}
                  className={`py-3.5 px-4 text-center text-sm font-semibold transition-all cursor-pointer select-none ${
                    activeTab === 'conversas'
                      ? 'bg-[#00a884] text-white font-bold'
                      : isDarkMode
                      ? 'text-[#e9edef] hover:bg-[#2a3942]'
                      : 'text-black hover:bg-gray-100'
                  }`}
                >
                  conversas anteriores
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('nova')}
                  className={`py-3.5 px-4 text-center text-sm font-semibold transition-all cursor-pointer select-none ${
                    activeTab === 'nova'
                      ? 'bg-[#00a884] text-white font-bold'
                      : isDarkMode
                      ? 'text-[#e9edef] hover:bg-[#2a3942]'
                      : 'text-black hover:bg-gray-100'
                  }`}
                >
                  Nova conversa
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('notas')}
                  className={`py-3.5 px-4 text-center text-sm font-semibold transition-all cursor-pointer select-none ${
                    activeTab === 'notas'
                      ? 'bg-[#00a884] text-white font-bold'
                      : isDarkMode
                      ? 'text-[#e9edef] hover:bg-[#2a3942]'
                      : 'text-black hover:bg-gray-100'
                  }`}
                >
                  notas
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'todos' ? 'info' : 'todos')}
                className="text-xs text-[#8696a0] hover:text-[#00a884] transition-colors flex items-center gap-1 cursor-pointer font-medium py-1"
              >
                {activeTab === 'todos' ? '← Voltar para navegação por abas' : '👁️ Exibir todos os painéis juntos'}
              </button>
            </div>
          </div>

          {/* Section C: Tab Content Views */}
          <div className={activeTab === 'todos' ? 'grid grid-cols-1 lg:grid-cols-2 gap-8' : 'w-full space-y-8'}>
            {/* CARD 1: Informações do Contato */}
            {(activeTab === 'info' || activeTab === 'todos') && (
              <div
                className={`p-6 rounded-2xl border space-y-5 ${
                  isDarkMode ? 'bg-[#202c33] border-[#2b3942]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center space-x-2 border-b pb-3 border-black/5 dark:border-white/10">
                  <Edit3 className="w-5 h-5 text-[#00a884]" />
                  <h3 className="font-bold text-base">Informações & Cadastro do Contato</h3>
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider mb-1.5">
                    Nome do Contato *
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      isDarkMode
                        ? 'bg-[#111b21] border-[#374248] focus:border-[#00a884] text-white'
                        : 'bg-[#f0f2f5] border-[#d1d7db] focus:border-[#00a884] text-[#111b21]'
                    }`}
                  />
                </div>

                {/* Telefone Formatado DDI + DDD + Numero */}
                <div>
                  <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider mb-1.5">
                    Telefone (DDI + DDD + Número) *
                  </label>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-4 sm:col-span-3">
                      <span className="text-[10px] text-[#8696a0] font-semibold block mb-1">DDI</span>
                      <div className="relative flex items-center">
                        <span className="absolute left-2 text-xs text-[#8696a0] font-bold">+</span>
                        <input
                          type="text"
                          value={ddi}
                          onChange={(e) => setDdi(e.target.value.replace(/\D/g, ''))}
                          maxLength={3}
                          placeholder="55"
                          className={`w-full pl-5 pr-1 py-2 rounded-lg border text-xs sm:text-sm font-semibold outline-none ${
                            isDarkMode
                              ? 'bg-[#111b21] border-[#374248] focus:border-[#00a884] text-white'
                              : 'bg-[#f0f2f5] border-[#d1d7db] focus:border-[#00a884] text-[#111b21]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="col-span-4 sm:col-span-3">
                      <span className="text-[10px] text-[#8696a0] font-semibold block mb-1">DDD</span>
                      <input
                        type="text"
                        value={ddd}
                        onChange={(e) => setDdd(e.target.value.replace(/\D/g, ''))}
                        maxLength={3}
                        placeholder="11"
                        className={`w-full px-2 py-2 rounded-lg border text-xs sm:text-sm font-semibold outline-none ${
                          isDarkMode
                            ? 'bg-[#111b21] border-[#374248] focus:border-[#00a884] text-white'
                            : 'bg-[#f0f2f5] border-[#d1d7db] focus:border-[#00a884] text-[#111b21]'
                        }`}
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-6">
                      <span className="text-[10px] text-[#8696a0] font-semibold block mb-1">Número</span>
                      <input
                        type="tel"
                        value={phoneNum}
                        onChange={handlePhoneNumChange}
                        placeholder="99999-8888"
                        className={`w-full px-3 py-2 rounded-lg border text-sm font-medium outline-none ${
                          isDarkMode
                            ? 'bg-[#111b21] border-[#374248] focus:border-[#00a884] text-white'
                            : 'bg-[#f0f2f5] border-[#d1d7db] focus:border-[#00a884] text-[#111b21]'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-xs font-mono text-[#00a884] bg-[#00a884]/5 px-3 py-2 rounded-lg border border-[#00a884]/20 flex items-center justify-between">
                    <span>Formato salvo no banco:</span>
                    <span className="font-bold">{fullPhoneRaw || '+5511999998888'}</span>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider mb-1.5">
                    E-mail do Contato (Opcional)
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="exemplo@cliente.com.br"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-colors ${
                      isDarkMode
                        ? 'bg-[#111b21] border-[#374248] focus:border-[#00a884] text-white'
                        : 'bg-[#f0f2f5] border-[#d1d7db] focus:border-[#00a884] text-[#111b21]'
                    }`}
                  />
                </div>

                {/* Descrição / Informações Adicionais */}
                <div>
                  <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider mb-1.5">
                    Descrição / Informações Adicionais do Contato
                  </label>
                  <textarea
                    value={contactDescription}
                    onChange={(e) => setContactDescription(e.target.value)}
                    placeholder="Escreva detalhes sobre o perfil do cliente, preferências de atendimento, cargo ou empresa..."
                    rows={3}
                    className={`w-full p-3 rounded-xl border text-sm outline-none resize-none transition-colors ${
                      isDarkMode
                        ? 'bg-[#111b21] border-[#374248] focus:border-[#00a884] text-white'
                        : 'bg-[#f0f2f5] border-[#d1d7db] focus:border-[#00a884] text-[#111b21]'
                    }`}
                  />
                </div>

                {/* Botão de Salvar no rodapé do formulário */}
                <div className="pt-3 border-t border-black/5 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSaveContactDetails()}
                    disabled={!contactName.trim()}
                    className="w-full py-3.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-40"
                  >
                    <Save className="w-5 h-5" />
                    <span>{isNewContactMode ? 'Salvar Novo Contato' : 'Salvar Dados do Contato'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* CARD 2: Conversas Anteriores */}
            {(activeTab === 'conversas' || activeTab === 'todos') && (
              <div
                className={`p-6 rounded-2xl border space-y-4 ${
                  isDarkMode ? 'bg-[#202c33] border-[#2b3942]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-3 border-black/5 dark:border-white/10">
                  <div className="flex items-center space-x-2">
                    <History className="w-5 h-5 text-blue-500" />
                    <h3 className="font-bold text-base">Conversas Anteriores</h3>
                  </div>
                  <span className="text-xs text-[#8696a0]">
                    {previousChatsList.length} registro(s)
                  </span>
                </div>

                {previousChatsList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8696a0] border border-dashed rounded-xl bg-black/5 dark:bg-white/5">
                    Nenhuma conversa gravada anteriormente para este contato.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {previousChatsList.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          onSelectChat(item);
                          onClose();
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
                          isDarkMode
                            ? 'bg-[#111b21] border-[#2b3942] hover:border-[#00a884]'
                            : 'bg-[#f0f2f5] border-[#e9edef] hover:border-[#00a884]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-[#00a884] flex items-center gap-1.5">
                            {item.channelName === 'grupo.kopla' ? (
                              <InstagramIcon className="w-4 h-4" />
                            ) : (
                              <WhatsappOficialIcon className="w-4 h-4" />
                            )}
                            {item.channelName || 'WhatsApp Oficial'}
                          </span>
                          <span className="text-[11px] text-[#8696a0] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.time}
                          </span>
                        </div>

                        <p className="text-xs text-[#8696a0] truncate mb-2">
                          {item.lastMessage || 'Atendimento iniciado'}
                        </p>

                        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                          <span className="text-xs text-[#2563eb] font-bold flex items-center gap-1">
                            Continuar atendimento
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CARD 3: Nova Conversa */}
            {(activeTab === 'nova' || activeTab === 'todos') && (
              <div
                className={`p-6 rounded-2xl border space-y-5 ${
                  isDarkMode ? 'bg-[#202c33] border-[#2b3942]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-3 border-black/5 dark:border-white/10">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-[#00a884]" />
                    <h3 className="font-bold text-base">Iniciar Nova Conversa</h3>
                  </div>
                  <span className="text-xs text-[#8696a0]">Caixa de Entrada</span>
                </div>

                {/* 1. Selecionar Inbox / Canal */}
                <div>
                  <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider mb-2">
                    1. Selecione a Caixa de Entrada (Canal) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AVAILABLE_CHANNELS.map((ch) => {
                      const isSelected = selectedChannel === ch.id;
                      return (
                        <div
                          key={ch.id}
                          onClick={() => setSelectedChannel(ch.id)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#00a884] bg-[#00a884]/10 shadow-xs ring-1 ring-[#00a884]'
                              : isDarkMode
                              ? 'border-[#374248] bg-[#111b21] hover:bg-[#202c33]'
                              : 'border-[#d1d7db] bg-[#f0f2f5] hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 truncate">
                            {ch.type === 'wa_official' && <WhatsappOficialIcon className="w-4 h-4" />}
                            {ch.type === 'instagram' && <InstagramIcon className="w-4 h-4" />}
                            {ch.type === 'messenger' && <MessengerIcon className="w-4 h-4" />}
                            <span className="text-xs font-semibold truncate">{ch.name}</span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-[#00a884] bg-[#00a884] text-white'
                                : 'border-[#8696a0]'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Mensagem Inicial / Nota Privada / Anexos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#8696a0] uppercase tracking-wider">
                      2. Mensagem Inicial (Opcional)
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsPrivate(!isPrivate)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer ${
                        isPrivate
                          ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                          : isDarkMode
                          ? 'bg-[#111b21] text-[#8696a0] hover:text-white'
                          : 'bg-[#e9edef] text-[#54656f] hover:text-[#111b21]'
                      }`}
                    >
                      <Lock className="w-3 h-3" />
                      <span>{isPrivate ? 'Nota Privada' : 'Mensagem Pública'}</span>
                    </button>
                  </div>

                  <div
                    className={`rounded-xl border p-3 transition-colors ${
                      isPrivate
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : isDarkMode
                        ? 'border-[#374248] bg-[#111b21]'
                        : 'border-[#d1d7db] bg-[#f0f2f5]'
                    }`}
                  >
                    <textarea
                      value={initialText}
                      onChange={(e) => setInitialText(e.target.value)}
                      placeholder={
                        isPrivate
                          ? 'Escreva uma nota interna para o time...'
                          : 'Digite uma mensagem inicial (ou deixe em branco para criar a conversa sem mensagem)...'
                      }
                      rows={3}
                      className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#8696a0]"
                    />

                    {/* Attachments list */}
                    {attachments.length > 0 && (
                      <div className="pt-2 border-t border-black/10 dark:border-white/10 mt-2 space-y-1.5">
                        {attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between bg-black/5 dark:bg-white/5 px-2.5 py-1.5 rounded-lg text-xs"
                          >
                            <div className="flex items-center space-x-2 truncate">
                              {att.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-blue-500" />}
                              {att.type === 'file' && <FileText className="w-3.5 h-3.5 text-amber-500" />}
                              {att.type === 'audio' && <Mic className="w-3.5 h-3.5 text-emerald-500" />}
                              <span className="truncate">{att.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                              className="text-[#8696a0] hover:text-red-500 p-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5 mt-2">
                      <div className="flex items-center space-x-2 text-[#8696a0]">
                        <button
                          type="button"
                          onClick={handleAddImageAttachment}
                          className="p-1.5 hover:text-[#00a884] transition-colors cursor-pointer"
                          title="Anexar Imagem"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleAddFileAttachment}
                          className="p-1.5 hover:text-[#00a884] transition-colors cursor-pointer"
                          title="Anexar Documento"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleAudio}
                          className={`p-1.5 transition-colors cursor-pointer ${
                            isAudioAttached ? 'text-emerald-500 font-bold' : 'hover:text-[#00a884]'
                          }`}
                          title="Anexar Áudio"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                      </div>

                      <span className="text-[11px] text-[#8696a0]">
                        {initialText.trim() ? `${initialText.length} caracteres` : 'Mensagem nula'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleFinalStartConversation}
                  disabled={!contactName.trim() && !selectedContact}
                  className="w-full py-3.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-40"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Criar Conversa / Iniciar Atendimento</span>
                </button>
              </div>
            )}

            {/* CARD 4: Notas */}
            {(activeTab === 'notas' || activeTab === 'todos') && (
              <div
                className={`p-6 rounded-2xl border flex flex-col justify-between ${
                  isDarkMode ? 'bg-[#202c33] border-[#2b3942]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3 border-black/5 dark:border-white/10">
                    <div className="flex items-center space-x-2">
                      <StickyNote className="w-5 h-5 text-amber-500" />
                      <h3 className="font-bold text-base">Notas e Descrições do Contato</h3>
                    </div>
                    <span className="text-xs text-[#8696a0]">
                      {notesList.length} nota(s) registradas
                    </span>
                  </div>

                  {/* New Note Form */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newNoteInput}
                      onChange={(e) => setNewNoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNote();
                        }
                      }}
                      placeholder="Adicionar nota interna para este contato..."
                      className={`flex-1 px-3.5 py-2 rounded-xl border text-sm outline-none ${
                        isDarkMode
                          ? 'bg-[#111b21] border-[#374248] focus:border-amber-500 text-white'
                          : 'bg-[#f0f2f5] border-[#d1d7db] focus:border-amber-500 text-[#111b21]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!newNoteInput.trim()}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      Adicionar
                    </button>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {notesList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#8696a0] border border-dashed rounded-xl bg-black/5 dark:bg-white/5">
                        Nenhuma nota interna adicionada ainda.
                      </div>
                    ) : (
                      notesList.map((note) => (
                        <div
                          key={note.id}
                          className={`p-3 rounded-xl border flex items-start justify-between space-x-3 ${
                            isDarkMode
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium whitespace-pre-wrap">{note.text}</p>
                            <span className="text-[10px] opacity-75 mt-1 block">
                              {note.author || 'Equipe'} • {note.date}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveNote(note.id)}
                            className="text-amber-500 hover:text-red-500 p-1 transition-colors cursor-pointer"
                            title="Remover nota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Informational tip */}
                <div className="pt-4 mt-4 border-t border-black/5 dark:border-white/5 text-[11px] text-[#8696a0] flex items-center space-x-2">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>As notas são mantidas de forma privada para a equipe e visíveis nos atendimentos.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
