import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  Filter,
  Copy,
  Calendar as CalendarIcon,
  Plus,
  MoreVertical,
  Upload,
  Download,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronDown,
  Square,
  CheckSquare,
} from 'lucide-react';
import { Chat, Attachment, Tag as TagType } from '../types';
import type { Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { contactService, type ContactBulkLabelAction } from '../integrations/chatwoot/contacts';
import { CalendarPicker } from './CalendarPicker';
import {
  WhatsappOficialIcon,
  WhatsappIcon,
  InstagramIcon,
  MessengerIcon,
} from './ChannelIcons';
import { ContextMenu } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { getContactContextMenuItems } from '../utils/contextMenuActions';
import { ToastContainer, ToastMessage } from './Toast';
import type { ContactsStatus } from '../features/contacts/useContacts';
import { useContactConversations } from '../features/contacts/useContactConversations';
import { useContactDetails } from '../features/contacts/useContactDetails';
import { useContactLabels } from '../features/contacts/useContactLabels';

export type FilterField =
  | 'nome'
  | 'email'
  | 'phone'
  | 'identifier'
  | 'country'
  | 'city'
  | 'company'
  | 'createdAt'
  | 'lastActivity'
  | 'sourceLink'
  | 'blocked'
  | 'tags';

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'x_days_before';

export interface FilterRule {
  id: string;
  combiner: 'AND' | 'OR';
  field: FilterField;
  operator: FilterOperator;
  value: string;
  valueDate?: string;
  valueDaysAgo?: number;
}

function parseDateStrToMs(dateStr?: string): number | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d).getTime();
      }
    }
  }
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
        return new Date(y, m, d).getTime();
      }
    }
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : parsed;
}

function getChatFieldValue(chat: Chat, field: FilterField): string | number | boolean | TagType[] {
  switch (field) {
    case 'nome':
      return chat.name || '';
    case 'email':
      return chat.email || '';
    case 'phone':
      return chat.phone || chat.about || '';
    case 'identifier':
      return chat.identifier || chat.id || '';
    case 'country':
      return chat.countryName || 'Brasil';
    case 'city':
      return chat.city || '';
    case 'company':
      return chat.company || '';
    case 'sourceLink':
      return chat.sourceLink || '';
    case 'blocked':
      return !!chat.isBlocked;
    case 'tags':
      return chat.tags || [];
    case 'createdAt': {
      if (chat.createdAt) return chat.createdAt;
      if (chat.createdAtRelative) {
        const now = new Date();
        const rel = chat.createdAtRelative;
        if (rel.endsWith('d')) {
          const days = parseInt(rel.slice(0, -1), 10) || 0;
          now.setDate(now.getDate() - days);
        } else if (rel.endsWith('h')) {
          const hours = parseInt(rel.slice(0, -1), 10) || 0;
          now.setHours(now.getHours() - hours);
        } else if (rel.endsWith('m')) {
          const mins = parseInt(rel.slice(0, -1), 10) || 0;
          now.setMinutes(now.getMinutes() - mins);
        }
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        return `${d}/${m}/${y}`;
      }
      return '';
    }
    case 'lastActivity': {
      if (chat.lastActivityAt) return chat.lastActivityAt;
      return '';
    }
    default:
      return '';
  }
}

function evaluateSingleRule(chat: Chat, rule: FilterRule): boolean {
  const { field, operator, value, valueDate, valueDaysAgo } = rule;
  const rawValue = getChatFieldValue(chat, field);

  // Date fields evaluation
  if (field === 'createdAt' || field === 'lastActivity') {
    const contactDateMs = parseDateStrToMs(String(rawValue));
    if (contactDateMs === null) return false;

    if (operator === 'x_days_before') {
      const days = valueDaysAgo !== undefined && !isNaN(valueDaysAgo) ? Number(valueDaysAgo) : Number(value);
      if (isNaN(days) || days <= 0) return true;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);
      const targetMs = targetDate.getTime();
      return contactDateMs <= targetMs;
    }

    const filterDateMs = parseDateStrToMs(valueDate || value);
    if (filterDateMs === null) return true;

    if (operator === 'greater_than') {
      return contactDateMs > filterDateMs;
    } else if (operator === 'less_than') {
      return contactDateMs < filterDateMs;
    } else if (operator === 'equals') {
      const d1 = new Date(contactDateMs).toDateString();
      const d2 = new Date(filterDateMs).toDateString();
      return d1 === d2;
    } else if (operator === 'not_equals') {
      const d1 = new Date(contactDateMs).toDateString();
      const d2 = new Date(filterDateMs).toDateString();
      return d1 !== d2;
    }
    return true;
  }

  // Boolean evaluation
  if (field === 'blocked') {
    const isBlocked = Boolean(rawValue);
    const targetBool = value.toLowerCase() === 'sim' || value.toLowerCase() === 'true';
    if (operator === 'equals') return isBlocked === targetBool;
    if (operator === 'not_equals') return isBlocked !== targetBool;
    return true;
  }

  // Tags evaluation
  if (field === 'tags') {
    const tagsArr = Array.isArray(rawValue) ? (rawValue as TagType[]) : [];
    const target = value.trim().toLowerCase();
    if (!target) return true;

    const hasTag = tagsArr.some((t) => t.label.toLowerCase().includes(target) || t.label.toLowerCase() === target);

    if (operator === 'equals') {
      return tagsArr.some((t) => t.label.toLowerCase() === target);
    } else if (operator === 'not_equals') {
      return !tagsArr.some((t) => t.label.toLowerCase() === target);
    } else if (operator === 'contains') {
      return hasTag;
    } else if (operator === 'not_contains') {
      return !hasTag;
    }
    return true;
  }

  // Text evaluations
  const strVal = String(rawValue).toLowerCase().trim();
  const searchVal = value.toLowerCase().trim();
  if (!searchVal && operator !== 'not_equals') return true;

  if (operator === 'equals') {
    return strVal === searchVal;
  } else if (operator === 'not_equals') {
    return strVal !== searchVal;
  } else if (operator === 'contains') {
    return strVal.includes(searchVal);
  } else if (operator === 'not_contains') {
    return !strVal.includes(searchVal);
  }

  return true;
}

function evaluateAllRules(chat: Chat, rules: FilterRule[]): boolean {
  if (rules.length === 0) return true;

  let result = evaluateSingleRule(chat, rules[0]);

  for (let i = 1; i < rules.length; i++) {
    const r = rules[i];
    const ruleMatch = evaluateSingleRule(chat, r);
    if (r.combiner === 'OR') {
      result = result || ruleMatch;
    } else {
      result = result && ruleMatch;
    }
  }

  return result;
}

interface Props {
  contacts: Chat[];
  contactsStatus?: ContactsStatus;
  contactsError?: string | null;
  onRetryContacts?: () => void;
  accountId: number | null;
  onOpenConversation: (conversationId: number) => void;
  inboxes: Inbox[];
  defaultInboxId?: number | null;
  onCreateContact?: (input: { name: string; phoneNumber?: string; email?: string }) => Promise<Chat | null>;
  onStartConversation?: (input: { contactId: number; inboxId: number; initialContent?: string; private: boolean }) => Promise<void>;
  isCreatingContact?: boolean;
  onCreateNewChat: (
    name: string,
    phone: string,
    channelName: string,
    initialMessageText?: string,
    isPrivate?: boolean,
    attachments?: Attachment[]
  ) => void;
  onUpdateContact?: (chatId: string, updates: Partial<Chat>) => Promise<void>;
  onDeleteContact?: (chatId: string) => Promise<void>;
  isMutatingContact?: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const ContactsView: React.FC<Props> = ({
  contacts: chats,
  contactsStatus = 'idle',
  contactsError = null,
  onRetryContacts,
  accountId,
  onOpenConversation,
  inboxes,
  defaultInboxId = null,
  onCreateContact,
  onStartConversation,
  isCreatingContact = false,
  onCreateNewChat,
  onUpdateContact,
  onDeleteContact,
  isMutatingContact = false,
  onClose,
  isDarkMode = false,
}) => {
  // Search and Filter States
  const [query, setQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState<'todos' | 'whatsapp' | 'instagram' | 'messenger' | 'notas'>('todos');

  // Top Bar Actions State (Sort & More Options)
  type SortField = 'name' | 'email' | 'company' | 'country' | 'city' | 'lastActivity' | 'createdAt';
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>('lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showSortFieldDropdown, setShowSortFieldDropdown] = useState<boolean>(false);
  const [showSortDirDropdown, setShowSortDirDropdown] = useState<boolean>(false);

  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);
  const [showSortMenu, setShowSortMenu] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);

  // Multi-Selection State
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showBatchTagsModal, setShowBatchTagsModal] = useState<boolean>(false);
  const [batchTagInput, setBatchTagInput] = useState<string>('');
  const [batchTagAction, setBatchTagAction] = useState<ContactBulkLabelAction>('add');
  const [isApplyingBatchTags, setIsApplyingBatchTags] = useState(false);
  const [showBatchDeleteConfirmModal, setShowBatchDeleteConfirmModal] = useState<boolean>(false);

  // Context Menu State
  const { menuState, openContextMenu, closeContextMenu } = useContextMenu();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (title: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToggleBlock = async (contact: Chat, blocked: boolean) => {
    if (!onUpdateContact || isMutatingContact) return;
    setOperationError(null);
    try {
      await onUpdateContact(contact.id, { isBlocked: blocked });
      addToast(blocked ? `Contato "${contact.name}" foi bloqueado` : `Contato "${contact.name}" foi desbloqueado`);
    } catch (cause) {
      const message = errorMessageForUser(cause);
      setOperationError(message);
      addToast(message, 'error');
    }
  };

  const handleDeleteContact = async (contact: Chat) => {
    if (!onDeleteContact || isMutatingContact) return;
    setOperationError(null);
    try {
      await onDeleteContact(contact.id);
      setSelectedContact((current) => current?.id === contact.id ? null : current);
      addToast(`Contato "${contact.name}" excluído com sucesso`);
    } catch (cause) {
      const message = errorMessageForUser(cause);
      setOperationError(message);
      addToast(message, 'error');
    }
  };

  const handleContactContextMenu = (e: React.MouseEvent, contact: Chat) => {
    const items = getContactContextMenuItems(contact, {
      onViewContact: (c) => {
        setSelectedContact(c);
        setMobileView('detail');
        addToast(`Visualizando ficha de ${c.name}`, 'info');
      },
      onEditContact: (c) => {
        setSelectedContact(c);
        setIsNewContactMode(false);
        setMobileView('detail');
        addToast(`Editando dados de ${c.name}`, 'info');
      },
      onDuplicateContact: (c) => {
        onCreateNewChat(
          `${c.name} (Cópia)`,
          c.phone || '',
          c.channelName || 'Whatsapp Oficial(1420)',
          undefined,
          false
        );
        addToast(`Contato "${c.name}" duplicado com sucesso!`);
      },
      onDeleteContact: (c) => {
        if (confirm(`Deseja realmente excluir permanentemente o contato "${c.name}"?`)) {
          void handleDeleteContact(c);
        }
      },
      onToggleBlock: (c) => {
        const nextBlocked = !c.isBlocked;
        void handleToggleBlock(c, nextBlocked);
      },
      onExportContact: (c) => {
        const dataStr =
          'data:text/json;charset=utf-8,' +
          encodeURIComponent(JSON.stringify(c, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute('href', dataStr);
        anchor.setAttribute(
          'download',
          `contato_${c.name.replace(/\s+/g, '_')}.json`
        );
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        addToast(`Ficha de "${c.name}" exportada com sucesso!`);
      },
      onPrintContact: (c) => {
        addToast(`Gerando relatório do contato ${c.name}...`, 'info');
        setTimeout(() => window.print(), 300);
      },
    });

    openContextMenu(e, items, `Contato: ${contact.name}`);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const sortFieldLabels: Record<SortField, string> = {
    name: 'Nome',
    email: 'E-mail',
    company: 'Empresa',
    country: 'País/região',
    city: 'Cidade',
    lastActivity: 'Última atividade',
    createdAt: 'Criado em',
  };

  const handleApplyBatchTags = async () => {
    const label = batchTagInput.trim();
    const contactIds = selectedContactIds.map(Number).filter(Number.isInteger);
    if (!accountId || !label || contactIds.length === 0 || isApplyingBatchTags) return;
    setOperationError(null);
    setIsApplyingBatchTags(true);
    try {
      await contactService.bulkUpdateLabels(accountId, contactIds, batchTagAction, [label]);
      setShowBatchTagsModal(false);
      setBatchTagInput('');
      setSelectedContactIds([]);
      void contactLabels.retry();
      const actionLabel = batchTagAction === 'add' ? 'agendada para adição' : 'agendada para remoção';
      setSaveSuccessMessage(`Etiqueta "${label}" ${actionLabel} em ${contactIds.length} contato(s).`);
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (cause) {
      setOperationError(errorMessageForUser(cause));
    } finally {
      setIsApplyingBatchTags(false);
    }
  };

  const handleBatchDelete = () => {
    selectedContactIds.forEach((contactId) => {
      if (onDeleteContact) {
        onDeleteContact(contactId);
      }
    });

    setSelectedContactIds([]);
    setShowBatchDeleteConfirmModal(false);
    setSaveSuccessMessage(`${selectedContactIds.length} contato(s) excluído(s).`);
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Advanced Filter Builder State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [activeCalendarRuleId, setActiveCalendarRuleId] = useState<string | null>(null);

  // Extract unique tag labels
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    chats.forEach((c) => {
      c.tags?.forEach((t) => {
        if (t.label) set.add(t.label);
      });
    });
    return Array.from(set);
  }, [chats]);

  const handleAddRule = () => {
    const newRule: FilterRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      combiner: 'AND',
      field: 'createdAt',
      operator: 'greater_than',
      value: '31/07/2026',
      valueDate: '31/07/2026',
    };
    setRules((prev) => [...prev, newRule]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRule = (id: string, updates: Partial<FilterRule>) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const updated = { ...r, ...updates };
          if (updates.field && updates.field !== r.field) {
            if (updates.field === 'createdAt' || updates.field === 'lastActivity') {
              updated.operator = 'greater_than';
              updated.valueDate = '31/07/2026';
              updated.value = '31/07/2026';
            } else if (updates.field === 'blocked') {
              updated.operator = 'equals';
              updated.value = 'Sim';
            } else if (updates.field === 'tags') {
              updated.operator = 'equals';
              updated.value = existingTags[0] || '';
            } else {
              updated.operator = 'contains';
              updated.value = '';
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Export All Contacts to CSV
  const handleExportContacts = () => {
    if (!filteredChats || filteredChats.length === 0) {
      setCopiedMessage('Nenhum contato para exportar');
      setTimeout(() => setCopiedMessage(null), 3000);
      return;
    }
    const headers = ['ID', 'Nome', 'Email', 'Telefone', 'Canal', 'Atendente', 'CriadoEm', 'Etiquetas'];
    const rows = filteredChats.map((c) => [
      c.id,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.phone || c.about || '').replace(/"/g, '""')}"`,
      `"${(c.channelName || '').replace(/"/g, '""')}"`,
      `"${(c.assignedAgent || '').replace(/"/g, '""')}"`,
      `"${c.createdAt || ''}"`,
      `"${(c.tags || []).map((t) => t.label).join(';')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contatos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedMessage(`${filteredChats.length} contatos exportados com sucesso!`);
    setTimeout(() => setCopiedMessage(null), 3000);
  };

  // Export Scheduled Contacts to CSV
  const handleExportScheduledContacts = () => {
    const scheduled = filteredChats.filter(
      (c) => c.lastMessageRelative?.includes('agendad') || c.lastMessage?.toLowerCase().includes('agendad')
    );
    const listToExport = scheduled.length > 0 ? scheduled : filteredChats.slice(0, Math.min(3, filteredChats.length));

    const headers = ['ID', 'Nome', 'Telefone', 'MensagemAgendada', 'DataAgendamento'];
    const rows = listToExport.map((c) => [
      c.id,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.phone || c.about || '').replace(/"/g, '""')}"`,
      `"${(c.lastMessage || 'Mensagem agendada').replace(/"/g, '""')}"`,
      `"${c.lastActivityAt || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `contatos_agendados_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setCopiedMessage(`${listToExport.length} contatos agendados exportados!`);
    setTimeout(() => setCopiedMessage(null), 3000);
  };

  // Import Contacts
  const handleTriggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            parsed.forEach((c) => {
              if (c.name) {
                onCreateNewChat({
                  id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                  name: c.name,
                  phone: c.phone || '+55 11 99999-9999',
                  email: c.email || '',
                  channelName: 'Whatsapp Oficial(1420)',
                  unreadCount: 0,
                  lastMessage: 'Contato importado',
                  lastMessageTime: 'Agora',
                });
              }
            });
          }
        } else {
          const lines = content.split('\n').filter((l) => l.trim().length > 0);
          lines.slice(1).forEach((line) => {
            const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
            if (parts.length >= 2 && parts[1]) {
              onCreateNewChat({
                id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                name: parts[1] || parts[0],
                phone: parts[3] || parts[2] || '+55 11 99999-9999',
                email: parts[2] || '',
                channelName: 'Whatsapp Oficial(1420)',
                unreadCount: 0,
                lastMessage: 'Contato importado',
                lastMessageTime: 'Agora',
              });
            }
          });
        }
        setSaveSuccessMessage('Contatos importados com sucesso!');
        setTimeout(() => setSaveSuccessMessage(null), 3000);
      } catch (err) {
        setCopiedMessage('Erro ao ler arquivo de importação.');
        setTimeout(() => setCopiedMessage(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Delete All Contacts
  const handleDeleteAllContacts = () => {
    filteredChats.forEach((c) => {
      onDeleteContact(c.id);
    });
    setShowDeleteConfirmModal(false);
    setSaveSuccessMessage('Todos os contatos foram excluídos.');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Selected Contact State
  const [selectedContact, setSelectedContact] = useState<Chat | null>(() => {
    const valid = chats.filter((c) => c.id !== 'me');
    return valid.length > 0 ? valid[0] : null;
  });

  useEffect(() => {
    setSelectedContact((current) => chats.find((contact) => contact.id === current?.id) || chats[0] || null);
    setSelectedContactIds((selected) => selected.filter((id) => chats.some((contact) => contact.id === id)));
  }, [chats]);

  const contactHistory = useContactConversations(
    accountId,
    selectedContact && /^\d+$/.test(selectedContact.id) ? Number(selectedContact.id) : null
  );
  const contactNotes = useContactDetails(
    accountId,
    selectedContact && /^\d+$/.test(selectedContact.id) ? Number(selectedContact.id) : null
  );
  const contactLabels = useContactLabels(
    accountId,
    selectedContact && /^\d+$/.test(selectedContact.id) ? Number(selectedContact.id) : null
  );

  // Form Fields State
  const [contactName, setContactName] = useState('');
  const [ddi, setDdi] = useState('55');
  const [ddd, setDdd] = useState('');
  const [phoneNum, setPhoneNum] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactDescription, setContactDescription] = useState('');
  const [newNoteInput, setNewNoteInput] = useState('');
  const [labelToAdd, setLabelToAdd] = useState('');

  // Feedback Toasts
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);

  // New Conversation Options
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [initialText, setInitialText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isAudioAttached, setIsAudioAttached] = useState(false);

  // Is creating new contact mode
  const [isNewContactMode, setIsNewContactMode] = useState(false);

  // Mobile View state: 'list' | 'detail'
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Active Tab View: 'info' | 'conversas' | 'nova' | 'notas' | 'todos'
  const [activeTab, setActiveTab] = useState<'info' | 'conversas' | 'nova' | 'notas' | 'todos'>('info');

  useEffect(() => {
    const preferredId = defaultInboxId && inboxes.some((inbox) => inbox.id === defaultInboxId) ? defaultInboxId : inboxes[0]?.id;
    if (!preferredId) { setSelectedChannel(''); return; }
    if (!inboxes.some((inbox) => String(inbox.id) === selectedChannel)) setSelectedChannel(String(preferredId));
  }, [defaultInboxId, inboxes, selectedChannel]);

  // Synchronize form when selectedContact changes
  useEffect(() => {
    if (selectedContact) {
      setIsNewContactMode(false);
      setContactName(selectedContact.name || '');

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
    setInitialText('');
    setAttachments([]);
    setMobileView('detail');
  };

  // Add a new note
  const handleAddNote = async () => {
    if (!newNoteInput.trim()) return;
    setOperationError(null);
    try {
      const created = await contactNotes.createNote(newNoteInput);
      if (created) setNewNoteInput('');
    } catch (cause) {
      setOperationError(errorMessageForUser(cause));
    }
  };

  const handleUpdateLabels = async (nextLabels: string[]) => {
    setOperationError(null);
    try {
      await contactLabels.update(nextLabels);
      setLabelToAdd('');
    } catch (cause) {
      setOperationError(errorMessageForUser(cause));
    }
  };

  // Save Contact Details
  const handleSaveContactDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!contactName.trim() || isMutatingContact) return;

    if (selectedContact && onUpdateContact && !isNewContactMode) {
      setOperationError(null);
      try {
        await onUpdateContact(selectedContact.id, {
          name: contactName.trim(),
          phone: fullPhoneRaw || undefined,
          email: contactEmail.trim(),
          description: contactDescription.trim(),
        });
        setSaveSuccessMessage('Informações do contato salvas com sucesso!');
        setTimeout(() => setSaveSuccessMessage(null), 3000);
      } catch (cause) {
        setOperationError(errorMessageForUser(cause));
      }
    } else {
      if (!onCreateContact) return;
      setOperationError(null);
      try {
        const created = await onCreateContact({
          name: contactName.trim(),
          ...(fullPhoneRaw ? { phoneNumber: fullPhoneRaw } : {}),
          ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}),
        });
        if (!created) return;
        setSelectedContact(created);
        setIsNewContactMode(false);
        setSaveSuccessMessage('Contato cadastrado com sucesso!');
        setTimeout(() => setSaveSuccessMessage(null), 3000);
      } catch (cause) {
        setOperationError(errorMessageForUser(cause));
      }
    }
  };

  // Copy phone or email
  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessage(`${label} copiado!`);
    setTimeout(() => setCopiedMessage(null), 2500);
  };

  // Delete contact
  const handleDeleteCurrentContact = async () => {
    if (!selectedContact) return;
    if (window.confirm(`Tem certeza que deseja excluir o contato "${selectedContact.name}"?`)) {
      const deleted = selectedContact;
      await handleDeleteContact(deleted);
    }
  };

  // Attachment Handlers
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

  // Start Conversation / Create Message
  const handleFinalStartConversation = async () => {
    if (!onStartConversation || !selectedChannel || isStartingConversation || isCreatingContact) return;
    setOperationError(null);
    setIsStartingConversation(true);
    try {
      let contact = selectedContact;
      if (isNewContactMode || !contact) {
        if (!onCreateContact || !contactName.trim()) return;
        contact = await onCreateContact({
          name: contactName.trim(),
          ...(fullPhoneRaw ? { phoneNumber: fullPhoneRaw } : {}),
          ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}),
        });
        if (!contact) return;
        setSelectedContact(contact);
        setIsNewContactMode(false);
      }
      await onStartConversation({
        contactId: Number(contact.id),
        inboxId: Number(selectedChannel),
        initialContent: initialText.trim() || undefined,
        private: isPrivate,
      });
      onClose();
    } catch (cause) {
      setOperationError(errorMessageForUser(cause));
    } finally {
      setIsStartingConversation(false);
    }
  };

  // Filter contacts directory list
  const validContacts = chats.filter((c) => c.id !== 'me');

  const filteredContacts = validContacts
    .filter((c) => {
      // Channel / type filter
      if (filterChannel === 'whatsapp') {
        if (c.channelName && c.channelName.toLowerCase().includes('instagram')) return false;
        if (c.channelName && c.channelName.toLowerCase().includes('messenger')) return false;
      } else if (filterChannel === 'instagram') {
        if (!c.channelName || !c.channelName.toLowerCase().includes('instagram')) return false;
      } else if (filterChannel === 'messenger') {
        if (!c.channelName || !c.channelName.toLowerCase().includes('messenger')) return false;
      } else if (filterChannel === 'notas') {
        if (!c.notes || c.notes.length === 0) return false;
      }

      // Advanced Filter Rules (AND | OR)
      if (rules.length > 0) {
        if (!evaluateAllRules(c, rules)) return false;
      }

      // Search query filter
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.about && c.about.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.notes && c.notes.some((n) => n.text.toLowerCase().includes(q)))
      );
    })
    .sort((a, b) => {
      let valA = '';
      let valB = '';

      switch (sortField) {
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'email':
          valA = a.email || '';
          valB = b.email || '';
          break;
        case 'company':
          valA = a.company || '';
          valB = b.company || '';
          break;
        case 'country':
          valA = a.countryName || '';
          valB = b.countryName || '';
          break;
        case 'city':
          valA = a.city || '';
          valB = b.city || '';
          break;
        case 'lastActivity':
          valA = a.lastActivityAt || a.time || '';
          valB = b.lastActivityAt || b.time || '';
          break;
        case 'createdAt':
          valA = a.createdAt || a.createdAtRelative || '';
          valB = b.createdAt || b.createdAtRelative || '';
          break;
      }

      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const filteredChats = filteredContacts;

  const allFilteredSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedContactIds.includes(c.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map((c) => c.id));
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col transition-colors select-text ${
        isDarkMode ? 'bg-[#0e0c0c] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
      }`}
    >
      {/* Top Header Bar */}
      <div
        className={`h-16 px-3 sm:px-6 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'bg-[#151717] border-[#1e1f1f]' : 'bg-white border-[#d1d7db]'
        }`}
      >
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              isDarkMode
                ? 'hover:bg-[#242525] text-[#aebac1]'
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
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#00a884] shrink-0" />
              <span className="truncate">Contatos & Clientes</span>
            </h1>
            <p className="text-xs text-[#8696a0] truncate hidden sm:block">
              Gerencie seus contatos, edite informações, veja histórico de conversas e adicione notas.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <button
            onClick={handlePrepareNewContact}
            className="px-3 sm:px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Novo Contato</span>
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

      {/* Save / Copy Toast Notifications */}
      {saveSuccessMessage && (
        <div className="bg-[#00a884] text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-center space-x-2 shadow-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {operationError && (
        <div className="bg-red-600 text-white px-6 py-2.5 text-xs font-semibold flex items-center justify-center shadow-md animate-fade-in">
          {operationError}
        </div>
      )}

      {copiedMessage && (
        <div className="bg-blue-600 text-white px-6 py-2 text-xs font-semibold flex items-center justify-center space-x-2 shadow-md animate-fade-in">
          <Copy className="w-4 h-4" />
          <span>{copiedMessage}</span>
        </div>
      )}

      {/* Main Two-Column Full-Screen Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* LEFT PANEL: CONTACTS DIRECTORY & SEARCH */}
        <div
          className={`w-full md:w-[380px] lg:w-[420px] ${
            mobileView === 'detail' ? 'hidden md:flex' : 'flex'
          } flex-col h-full shrink-0 border-r ${
            isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'
          }`}
        >
          {/* Search Box & Channel Filters */}
          <div className={`p-3 space-y-2.5 border-b ${isDarkMode ? 'border-[#222d34]' : 'border-[#d1d7db]'}`}>
            <div className="flex items-center space-x-1.5">
              {/* Hidden File Input for Importing Contacts */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFileChange}
                accept=".csv,.json"
                className="hidden"
              />

              {/* Search Box Input */}
              <div
                className={`flex-1 flex items-center rounded-xl h-10 px-3 border transition-colors ${
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
                  placeholder="Pesquisar..."
                  className="w-full bg-transparent text-xs sm:text-sm outline-none placeholder:text-[#8696a0]"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-[#8696a0] hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Button */}
              <button
                type="button"
                onClick={() => {
                  setShowAdvancedFilters(!showAdvancedFilters);
                  if (!showAdvancedFilters && rules.length === 0) {
                    handleAddRule();
                  }
                }}
                className={`h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                  showAdvancedFilters || rules.length > 0
                    ? 'bg-[#00a884] text-white border-[#00a884] shadow-xs'
                    : isDarkMode
                    ? 'bg-[#202c33] border-[#2a3942] text-[#aebac1] hover:text-white hover:bg-[#2a3942]'
                    : 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
                }`}
                title="Filtro Avançado"
              >
                <Filter className="w-4 h-4 shrink-0" />
              </button>

              {/* Sort Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSortMenu(!showSortMenu);
                    setShowMoreMenu(false);
                    setShowSortFieldDropdown(false);
                    setShowSortDirDropdown(false);
                  }}
                  className={`h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                    showSortMenu
                      ? 'bg-[#00a884] text-white border-[#00a884]'
                      : isDarkMode
                      ? 'bg-[#202c33] border-[#2a3942] text-[#aebac1] hover:text-white hover:bg-[#2a3942]'
                      : 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
                  }`}
                  title="Ordenar contatos"
                >
                  <ArrowUpDown className="w-4 h-4 shrink-0" />
                </button>

                {showSortMenu && (
                  <div
                    className={`absolute right-0 top-full mt-2 w-72 rounded-2xl border shadow-2xl p-3 z-50 space-y-3 ${
                      isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
                    }`}
                  >
                    {/* Classificar por */}
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#8696a0]">Classificar por</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSortFieldDropdown(!showSortFieldDropdown);
                            setShowSortDirDropdown(false);
                          }}
                          className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 text-xs font-semibold cursor-pointer transition-all ${
                            isDarkMode
                              ? 'bg-[#202c33] border-[#2a3942] text-white hover:bg-[#2a3942]'
                              : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          <span>{sortFieldLabels[sortField]}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-[#8696a0]" />
                        </button>

                        {/* Field Options Dropdown Submenu */}
                        {showSortFieldDropdown && (
                          <div
                            className={`absolute right-0 top-full mt-1 w-48 rounded-xl border shadow-2xl py-1 z-50 ${
                              isDarkMode
                                ? 'bg-[#222528] border-[#33383d] text-white'
                                : 'bg-white border-gray-200 text-black'
                            }`}
                          >
                            {(
                              [
                                { id: 'name', label: 'Nome' },
                                { id: 'email', label: 'E-mail' },
                                { id: 'company', label: 'Empresa' },
                                { id: 'country', label: 'País/região' },
                                { id: 'city', label: 'Cidade' },
                                { id: 'lastActivity', label: 'Última atividade' },
                                { id: 'createdAt', label: 'Criado em' },
                              ] as const
                            ).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSortField(item.id);
                                  setShowSortFieldDropdown(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                                  sortField === item.id
                                    ? 'text-[#00a884] font-bold bg-[#00a884]/10'
                                    : isDarkMode
                                    ? 'hover:bg-[#2e343a]'
                                    : 'hover:bg-gray-100'
                                }`}
                              >
                                <span>{item.label}</span>
                                {sortField === item.id && <Check className="w-3.5 h-3.5 text-[#00a884]" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ordenação */}
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#8696a0]">Ordenação</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSortDirDropdown(!showSortDirDropdown);
                            setShowSortFieldDropdown(false);
                          }}
                          className={`px-3 py-1.5 rounded-xl border flex items-center space-x-1.5 text-xs font-semibold cursor-pointer transition-all ${
                            isDarkMode
                              ? 'bg-[#202c33] border-[#2a3942] text-white hover:bg-[#2a3942]'
                              : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          <span>{sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}</span>
                          <ChevronDown className="w-3.5 h-3.5 text-[#8696a0]" />
                        </button>

                        {/* Direction Dropdown Submenu */}
                        {showSortDirDropdown && (
                          <div
                            className={`absolute right-0 top-full mt-1 w-36 rounded-xl border shadow-2xl py-1 z-50 ${
                              isDarkMode
                                ? 'bg-[#222528] border-[#33383d] text-white'
                                : 'bg-white border-gray-200 text-black'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSortDirection('asc');
                                setShowSortDirDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                                sortDirection === 'asc'
                                  ? 'text-[#00a884] font-bold bg-[#00a884]/10'
                                  : isDarkMode
                                  ? 'hover:bg-[#2e343a]'
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              <span>Crescente</span>
                              {sortDirection === 'asc' && <Check className="w-3.5 h-3.5 text-[#00a884]" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSortDirection('desc');
                                setShowSortDirDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                                sortDirection === 'desc'
                                  ? 'text-[#00a884] font-bold bg-[#00a884]/10'
                                  : isDarkMode
                                  ? 'hover:bg-[#2e343a]'
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              <span>Decrescente</span>
                              {sortDirection === 'desc' && <Check className="w-3.5 h-3.5 text-[#00a884]" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* More Vertical Options Dropdown (Matches requested screenshot) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(!showMoreMenu);
                    setShowSortMenu(false);
                  }}
                  className={`h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                    showMoreMenu
                      ? 'bg-[#2a3942] text-white border-[#00a884]'
                      : isDarkMode
                      ? 'bg-[#202c33] border-[#2a3942] text-[#aebac1] hover:text-white hover:bg-[#2a3942]'
                      : 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
                  }`}
                  title="Mais opções"
                >
                  <MoreVertical className="w-4 h-4 shrink-0" />
                </button>

                {showMoreMenu && (
                  <div
                    className={`absolute right-0 top-full mt-2 w-60 rounded-2xl border shadow-2xl py-2 z-50 transition-all ${
                      isDarkMode
                        ? 'bg-[#222528] border-[#33383d] text-white'
                        : 'bg-white border-gray-200 text-[#111b21]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handlePrepareNewContact();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                        isDarkMode ? 'hover:bg-[#2e343a] text-gray-200' : 'hover:bg-[#f0f2f5] text-gray-800'
                      }`}
                    >
                      <Plus className="w-4 h-4 text-[#8696a0]" />
                      <span>Adicionar contato</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleExportContacts();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                        isDarkMode ? 'hover:bg-[#2e343a] text-gray-200' : 'hover:bg-[#f0f2f5] text-gray-800'
                      }`}
                    >
                      <Upload className="w-4 h-4 text-[#8696a0]" />
                      <span>Exportar contatos</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleExportScheduledContacts();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                        isDarkMode ? 'hover:bg-[#2e343a] text-gray-200' : 'hover:bg-[#f0f2f5] text-gray-800'
                      }`}
                    >
                      <Upload className="w-4 h-4 text-[#8696a0]" />
                      <span>Exportar contatos agendados</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleTriggerImport();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                        isDarkMode ? 'hover:bg-[#2e343a] text-gray-200' : 'hover:bg-[#f0f2f5] text-gray-800'
                      }`}
                    >
                      <Download className="w-4 h-4 text-[#8696a0]" />
                      <span>Importar contatos</span>
                    </button>

                    <div className={`my-1 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`} />

                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirmModal(true);
                        setShowMoreMenu(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 text-xs font-semibold text-[#f87171] hover:text-red-400 transition-colors cursor-pointer ${
                        isDarkMode ? 'hover:bg-[#2e343a]' : 'hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-4 h-4 text-[#f87171]" />
                      <span>Excluir todos os contatos</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'instagram', label: 'Instagram' },
                  { id: 'messenger', label: 'Messenger' },
                  { id: 'notas', label: 'Com Notas' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterChannel(f.id)}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-all cursor-pointer ${
                    filterChannel === f.id
                      ? 'bg-[#00a884] text-white font-bold shadow-xs'
                      : isDarkMode
                      ? 'bg-[#202c33] text-[#aebac1] hover:bg-[#2a3942]'
                      : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Filter Builder Panel */}
          {showAdvancedFilters && (
            <div
              className={`p-3 border-b space-y-3 transition-all ${
                isDarkMode ? 'bg-[#151717] border-[#222d34]' : 'bg-[#f8fafc] border-[#d1d7db]'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center space-x-2">
                  <Filter className="w-3.5 h-3.5 text-[#00a884]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#00a884]">
                    Filtros Avançados
                  </span>
                </div>
                {rules.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRules([])}
                    className="text-[11px] text-[#8696a0] hover:text-red-400 cursor-pointer font-medium"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-2 space-y-1.5">
                  <p className="text-xs text-[#8696a0]">Nenhum filtro ativo no momento.</p>
                  <button
                    type="button"
                    onClick={handleAddRule}
                    className="text-xs font-semibold text-[#3b82f6] hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar filtro</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule, idx) => {
                    const isDateField = rule.field === 'createdAt' || rule.field === 'lastActivity';
                    const isBlockedField = rule.field === 'blocked';
                    const isTagsField = rule.field === 'tags';

                    return (
                      <div
                        key={rule.id}
                        className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-black/10 dark:bg-white/5 border border-white/5 relative"
                      >
                        {/* Combiner E / OU for rule 2+ */}
                        {idx > 0 && (
                          <div className="shrink-0">
                            <select
                              value={rule.combiner}
                              onChange={(e) =>
                                handleUpdateRule(rule.id, { combiner: e.target.value as 'AND' | 'OR' })
                              }
                              className={`px-1.5 py-1 rounded-lg text-xs font-bold cursor-pointer border outline-none ${
                                isDarkMode
                                  ? 'bg-[#202c33] border-[#2a3942] text-white'
                                  : 'bg-white border-gray-300 text-black'
                              }`}
                            >
                              <option value="AND">E</option>
                              <option value="OR">OU</option>
                            </select>
                          </div>
                        )}

                        {/* Field Select */}
                        <div className="shrink-0">
                          <select
                            value={rule.field}
                            onChange={(e) =>
                              handleUpdateRule(rule.id, { field: e.target.value as FilterField })
                            }
                            className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer border outline-none ${
                              isDarkMode
                                ? 'bg-[#202c33] border-[#2a3942] text-white'
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          >
                            <option value="nome">Nome</option>
                            <option value="email">E-mail</option>
                            <option value="phone">Número de telefone</option>
                            <option value="identifier">Identificador</option>
                            <option value="country">Nome do País</option>
                            <option value="city">Cidade</option>
                            <option value="company">Empresa</option>
                            <option value="createdAt">Criado em</option>
                            <option value="lastActivity">Última atividade</option>
                            <option value="sourceLink">Link de origem</option>
                            <option value="blocked">Bloqueado</option>
                            <option value="tags">Etiquetas</option>
                          </select>
                        </div>

                        {/* Operator Select */}
                        <div className="shrink-0">
                          <select
                            value={rule.operator}
                            onChange={(e) =>
                              handleUpdateRule(rule.id, { operator: e.target.value as FilterOperator })
                            }
                            className={`px-2 py-1 rounded-lg text-xs cursor-pointer border outline-none ${
                              isDarkMode
                                ? 'bg-[#202c33] border-[#2a3942] text-white'
                                : 'bg-white border-gray-300 text-black'
                            }`}
                          >
                            {isDateField ? (
                              <>
                                <option value="greater_than">&gt; É maior que</option>
                                <option value="less_than">&lt; É menor que</option>
                                <option value="equals">= Igual a</option>
                                <option value="not_equals">≠ Diferente</option>
                                <option value="x_days_before">É X dias antes</option>
                              </>
                            ) : isBlockedField ? (
                              <>
                                <option value="equals">= Igual a</option>
                                <option value="not_equals">≠ Diferente</option>
                              </>
                            ) : isTagsField ? (
                              <>
                                <option value="equals">= Igual a</option>
                                <option value="not_equals">≠ Diferente</option>
                                <option value="contains">Contém</option>
                                <option value="not_contains">Não contém</option>
                              </>
                            ) : (
                              <>
                                <option value="equals">= Igual a</option>
                                <option value="not_equals">≠ Diferente</option>
                                <option value="contains">Contém</option>
                                <option value="not_contains">Não contém</option>
                              </>
                            )}
                          </select>
                        </div>

                        {/* Value Input / Selector / Date Picker */}
                        <div className="flex-1 min-w-[120px] relative">
                          {isDateField ? (
                            rule.operator === 'x_days_before' ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={rule.valueDaysAgo || rule.value || ''}
                                  onChange={(e) =>
                                    handleUpdateRule(rule.id, {
                                      valueDaysAgo: parseInt(e.target.value, 10) || 0,
                                      value: e.target.value,
                                    })
                                  }
                                  placeholder="7"
                                  className={`w-16 px-2 py-1 rounded-lg text-xs border outline-none ${
                                    isDarkMode
                                      ? 'bg-[#202c33] border-[#2a3942] text-white'
                                      : 'bg-white border-gray-300 text-black'
                                  }`}
                                />
                                <span className="text-[11px] text-[#8696a0]">dias</span>
                              </div>
                            ) : (
                              <div className="relative">
                                <div
                                  onClick={() =>
                                    setActiveCalendarRuleId(
                                      activeCalendarRuleId === rule.id ? null : rule.id
                                    )
                                  }
                                  className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs border cursor-pointer ${
                                    isDarkMode
                                      ? 'bg-[#202c33] border-[#2a3942] text-white'
                                      : 'bg-white border-gray-300 text-black'
                                  }`}
                                >
                                  <span>{rule.valueDate || rule.value || 'dd/mm/aaaa'}</span>
                                  <CalendarIcon className="w-3.5 h-3.5 text-[#8696a0] hover:text-[#00a884]" />
                                </div>

                                {/* Floating Calendar Popover */}
                                {activeCalendarRuleId === rule.id && (
                                  <div className="absolute top-full left-0 mt-1 z-50">
                                    <CalendarPicker
                                      selectedDate={rule.valueDate || rule.value}
                                      isDarkMode={isDarkMode}
                                      onSelectDate={(dateStr) => {
                                        handleUpdateRule(rule.id, {
                                          valueDate: dateStr,
                                          value: dateStr,
                                        });
                                        setActiveCalendarRuleId(null);
                                      }}
                                      onClear={() => {
                                        handleUpdateRule(rule.id, {
                                          valueDate: '',
                                          value: '',
                                        });
                                        setActiveCalendarRuleId(null);
                                      }}
                                      onClose={() => setActiveCalendarRuleId(null)}
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          ) : isBlockedField ? (
                            <select
                              value={rule.value || 'Sim'}
                              onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                              className={`w-full px-2 py-1 rounded-lg text-xs cursor-pointer border outline-none ${
                                isDarkMode
                                  ? 'bg-[#202c33] border-[#2a3942] text-white'
                                  : 'bg-white border-gray-300 text-black'
                              }`}
                            >
                              <option value="Sim">Sim</option>
                              <option value="Não">Não</option>
                            </select>
                          ) : isTagsField ? (
                            existingTags.length > 0 ? (
                              <select
                                value={rule.value || existingTags[0]}
                                onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                                className={`w-full px-2 py-1 rounded-lg text-xs cursor-pointer border outline-none ${
                                  isDarkMode
                                    ? 'bg-[#202c33] border-[#2a3942] text-white'
                                    : 'bg-white border-gray-300 text-black'
                                }`}
                              >
                                {existingTags.map((tag) => (
                                  <option key={tag} value={tag}>
                                    {tag}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div
                                className={`px-2 py-1 rounded-lg text-xs italic border ${
                                  isDarkMode
                                    ? 'bg-[#202c33] border-[#2a3942] text-[#8696a0]'
                                    : 'bg-gray-100 border-gray-300 text-gray-500'
                                }`}
                              >
                                Nenhuma etiqueta existente
                              </div>
                            )
                          ) : (
                            <input
                              type="text"
                              value={rule.value}
                              onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                              placeholder="Informe o valor..."
                              className={`w-full px-2 py-1 rounded-lg text-xs border outline-none ${
                                isDarkMode
                                  ? 'bg-[#202c33] border-[#2a3942] text-white placeholder:text-[#8696a0]'
                                  : 'bg-white border-gray-300 text-black placeholder:text-gray-400'
                              }`}
                            />
                          )}
                        </div>

                        {/* Remove Rule Trash Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(rule.id)}
                          title="Remover filtro"
                          className={`p-1 rounded-lg transition-colors cursor-pointer shrink-0 ${
                            isDarkMode
                              ? 'text-[#8696a0] hover:text-red-400 hover:bg-[#202c33]'
                              : 'text-gray-500 hover:text-red-600 hover:bg-gray-200'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add Filter Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="text-xs font-semibold text-[#3b82f6] hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar filtro</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-Selection Action Header Bar */}
          {selectedContactIds.length > 0 && (
            <div
              className={`p-3 border-b flex flex-wrap items-center justify-between gap-2 transition-all animate-fade-in ${
                isDarkMode ? 'bg-[#1f2c34] border-[#00a884]/30' : 'bg-[#e7fce9] border-[#00a884]/30 text-[#111b21]'
              }`}
            >
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="flex items-center space-x-1.5 text-xs font-bold cursor-pointer text-[#00a884] hover:underline"
                >
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      allFilteredSelected
                        ? 'bg-[#00a884] border-[#00a884] text-white'
                        : isDarkMode
                        ? 'border-gray-500 bg-[#202c33]'
                        : 'border-gray-400 bg-white'
                    }`}
                  >
                    {allFilteredSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                  </div>
                  <span>{allFilteredSelected ? 'Desmarcar todos' : 'Selecionar todos'}</span>
                </button>

                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#00a884]/20 text-[#00a884]">
                  {selectedContactIds.length} selecionado(s)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setBatchTagAction('add');
                    setBatchTagInput('');
                    setShowBatchTagsModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#00a884] hover:bg-[#008069] text-white flex items-center space-x-1 cursor-pointer shadow-xs transition-colors"
                  title="Adicionar etiquetas aos contatos selecionados"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Adicionar etiquetas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBatchTagAction('remove');
                    setBatchTagInput('');
                    setShowBatchTagsModal(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center space-x-1 cursor-pointer shadow-xs transition-colors"
                  title="Remover etiquetas dos contatos selecionados"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Remover etiquetas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirmModal(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-500 text-white flex items-center space-x-1 cursor-pointer shadow-xs transition-colors"
                  title="Excluir contatos selecionados"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedContactIds([])}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-[#2a3942] text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                  }`}
                  title="Limpar seleção"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Contact Directory Scrollable List */}
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

            {contactsStatus === 'loading' ? (
              <div className="p-8 text-center text-xs text-[#8696a0]">Carregando contatos…</div>
            ) : contactsStatus === 'error' ? (
              <div className="p-8 text-center text-xs text-[#8696a0] space-y-3">
                <p>{contactsError || 'Não foi possível carregar os contatos.'}</p>
                <button type="button" onClick={onRetryContacts} className="text-[#00a884] font-semibold hover:underline">Tentar novamente</button>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#8696a0]">
                Nenhum contato encontrado com esses filtros.
              </div>
            ) : (
              filteredContacts.map((c) => {
                const isSelected = selectedContact?.id === c.id && !isNewContactMode;
                const isInstagram = c.channelName && c.channelName.toLowerCase().includes('instagram');
                const isMessenger = c.channelName && c.channelName.toLowerCase().includes('messenger');
                const isChecked = selectedContactIds.includes(c.id);

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedContact(c);
                      setMobileView('detail');
                    }}
                    onContextMenu={(e) => handleContactContextMenu(e, c)}
                    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all select-none ${
                      isChecked
                        ? isDarkMode
                          ? 'bg-[#00a884]/15 border-l-4 border-[#00a884]'
                          : 'bg-[#e7fce9] border-l-4 border-[#00a884]'
                        : isSelected
                        ? isDarkMode
                          ? 'bg-[#202c33] border-l-4 border-[#00a884]'
                          : 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                        : isDarkMode
                        ? 'hover:bg-[#202c33]/60'
                        : 'hover:bg-[#f0f2f5]'
                    }`}
                  >
                    {/* Contact Avatar with square checkbox hover overlay */}
                    <div
                      className="relative shrink-0 group/avatar cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedContactIds((prev) =>
                          prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                        );
                      }}
                      title={isChecked ? 'Desmarcar contato' : 'Clique para selecionar este contato'}
                    >
                      <div className="w-11 h-11 rounded-full bg-[#0284c7] text-white font-bold text-sm flex items-center justify-center overflow-hidden shadow-xs">
                        {c.avatarType === 'image' && c.avatar ? (
                          <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{c.name.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>

                      {/* Checkbox square overlay on hover or when checked */}
                      <div
                        className={`absolute inset-0 rounded-full flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-[#00a884] text-white opacity-100 ring-2 ring-white dark:ring-[#111b21]'
                            : 'bg-black/50 text-white opacity-0 group-hover/avatar:opacity-100'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                            isChecked ? 'border-white bg-[#00a884]' : 'border-white bg-black/40'
                          }`}
                        >
                          {isChecked ? (
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-white/80" />
                          )}
                        </div>
                      </div>

                      {/* Channel Badge (when not checked) */}
                      {!isChecked && (
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#111b21] p-0.5 rounded-full shadow-xs">
                          {isInstagram ? (
                            <InstagramIcon className="w-3.5 h-3.5" />
                          ) : isMessenger ? (
                            <MessengerIcon className="w-3.5 h-3.5" />
                          ) : (
                            <WhatsappOficialIcon className="w-3.5 h-3.5" />
                          )}
                        </div>
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

        {/* RIGHT MAIN PANEL: FULL CONTACT DETAILS & EDITOR */}
        <div
          className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 ${
            mobileView === 'list' ? 'hidden md:block' : 'block'
          }`}
        >
          {/* Banner: Profile Header */}
          <div
            className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs ${
              isDarkMode ? 'bg-[#202c33] border-[#2b3942]' : 'bg-white border-[#e9edef]'
            }`}
          >
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-[#00a884] text-white font-extrabold text-xl flex items-center justify-center shadow-md shrink-0">
                {contactName.trim()
                  ? contactName.trim().substring(0, 2).toUpperCase()
                  : 'NC'}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <span className="truncate">{contactName.trim() || 'Novo Contato Sem Nome'}</span>
                  {isNewContactMode && (
                    <span className="text-xs bg-[#00a884]/20 text-[#00a884] font-semibold px-2.5 py-0.5 rounded-full shrink-0">
                      Novo Cadastro
                    </span>
                  )}
                </h2>
                <div className="flex items-center space-x-3 text-xs text-[#8696a0] font-mono mt-1">
                  <span>{fullPhoneFormatted}</span>
                  {fullPhoneFormatted && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(fullPhoneFormatted, 'Telefone')}
                      className="hover:text-[#00a884] p-1 cursor-pointer"
                      title="Copiar telefone"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedContact && !isNewContactMode && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('nova');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Iniciar Conversa</span>
                </button>
              )}

              <button
                  type="button"
                  onClick={() => handleSaveContactDetails()}
                  disabled={!contactName.trim() || isCreatingContact || isMutatingContact}
                className="px-4 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center space-x-2 disabled:opacity-40"
              >
                <Save className="w-4 h-4" />
                <span>{isCreatingContact ? 'Salvando…' : isNewContactMode ? 'Salvar Novo Contato' : 'Salvar Dados'}</span>
              </button>

              {selectedContact && !isNewContactMode && onDeleteContact && (
                <button
                  type="button"
                  onClick={handleDeleteCurrentContact}
                  disabled={isMutatingContact}
                  className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs transition-all cursor-pointer flex items-center space-x-1"
                  title="Excluir Contato"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation Bar (Exact layout model requested) */}
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

          {/* Tab Content Views */}
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

                {selectedContact && !isNewContactMode && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#8696a0] uppercase tracking-wider">
                      Etiquetas do Contato
                    </label>
                    {contactLabels.status === 'loading' ? (
                      <p className="text-xs text-[#8696a0]">Carregando etiquetas…</p>
                    ) : contactLabels.status === 'error' ? (
                      <div className="text-xs text-red-500 space-y-1">
                        <p>{contactLabels.error}</p>
                        <button type="button" onClick={() => void contactLabels.retry()} className="font-bold text-[#00a884] hover:underline">Tentar novamente</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1.5 min-h-6">
                          {contactLabels.labels.length === 0 ? (
                            <span className="text-xs text-[#8696a0]">Nenhuma etiqueta associada.</span>
                          ) : contactLabels.labels.map((label) => {
                            const catalogLabel = contactLabels.availableLabels.find((item) => item.title === label);
                            return (
                              <span key={label} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold bg-[#00a884]/10 text-[#008f70] border border-[#00a884]/20">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catalogLabel?.color || '#00a884' }} />
                                {label}
                                <button type="button" disabled={contactLabels.isUpdating} onClick={() => void handleUpdateLabels(contactLabels.labels.filter((item) => item !== label))} className="hover:text-red-500 disabled:opacity-40" title={`Remover etiqueta ${label}`}>
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex gap-2">
                          <select value={labelToAdd} onChange={(event) => setLabelToAdd(event.target.value)} disabled={contactLabels.isUpdating || contactLabels.availableLabels.length === 0} className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${isDarkMode ? 'bg-[#111b21] border-[#374248] text-white' : 'bg-[#f0f2f5] border-[#d1d7db] text-[#111b21]'}`}>
                            <option value="">Selecionar etiqueta…</option>
                            {contactLabels.availableLabels.filter((label) => !contactLabels.labels.includes(label.title)).map((label) => (
                              <option key={label.id} value={label.title}>{label.title}</option>
                            ))}
                          </select>
                          <button type="button" disabled={!labelToAdd || contactLabels.isUpdating} onClick={() => void handleUpdateLabels([...contactLabels.labels, labelToAdd])} className="px-3 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-bold disabled:opacity-40">
                            {contactLabels.isUpdating ? 'Salvando…' : 'Adicionar'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-3 border-t border-black/5 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleSaveContactDetails()}
                    disabled={!contactName.trim() || isCreatingContact || isMutatingContact}
                    className="w-full py-3.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-40"
                  >
                    <Save className="w-5 h-5" />
                    <span>{isCreatingContact ? 'Salvando…' : isNewContactMode ? 'Salvar Novo Contato' : 'Salvar Dados do Contato'}</span>
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
                    {contactHistory.conversations.length} registro(s)
                  </span>
                </div>

                {contactHistory.status === 'loading' ? (
                  <div className="p-8 text-center text-xs text-[#8696a0] border border-dashed rounded-xl bg-black/5 dark:bg-white/5">
                    Carregando conversas deste contato…
                  </div>
                ) : contactHistory.status === 'error' ? (
                  <div className="p-8 text-center text-xs text-red-500 border border-dashed rounded-xl bg-black/5 dark:bg-white/5 space-y-3">
                    <p>{contactHistory.error}</p>
                    <button type="button" onClick={() => void contactHistory.retry()} className="font-bold text-[#00a884] hover:underline">Tentar novamente</button>
                  </div>
                ) : contactHistory.conversations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8696a0] border border-dashed rounded-xl bg-black/5 dark:bg-white/5">
                    Nenhuma conversa gravada anteriormente para este contato.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {contactHistory.conversations.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          onOpenConversation(item.id);
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
                            {item.channelType?.toLowerCase().includes('instagram') ? (
                              <InstagramIcon className="w-4 h-4" />
                            ) : (
                              <WhatsappOficialIcon className="w-4 h-4" />
                            )}
                            {inboxes.find((inbox) => inbox.id === item.inboxId)?.name || item.channelType || 'Canal'}
                          </span>
                          <span className="text-[11px] text-[#8696a0] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.lastActivityAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                    {inboxes.map((inbox) => {
                      const isSelected = selectedChannel === String(inbox.id);
                      return (
                        <div
                          key={inbox.id}
                          onClick={() => setSelectedChannel(String(inbox.id))}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#00a884] bg-[#00a884]/10 shadow-xs ring-1 ring-[#00a884]'
                              : isDarkMode
                              ? 'border-[#374248] bg-[#111b21] hover:bg-[#202c33]'
                              : 'border-[#d1d7db] bg-[#f0f2f5] hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 truncate">
                            {inbox.avatarUrl ? <img src={inbox.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" /> : <WhatsappOficialIcon className="w-4 h-4" />}
                            <span className="text-xs font-semibold truncate">{inbox.name}</span>
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
                    {inboxes.length === 0 && <p className="text-xs text-[#8696a0]">Nenhuma inbox disponível para iniciar a conversa.</p>}
                  </div>
                </div>

                {/* 2. Mensagem Inicial */}
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
                          : 'Digite uma mensagem inicial...'
                      }
                      rows={3}
                      className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[#8696a0]"
                    />

                    {/* Attachments */}
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

                {/* Submit button */}
                {operationError && <p className="text-xs text-red-500">{operationError}</p>}
                <button
                  type="button"
                  onClick={handleFinalStartConversation}
                  disabled={(!contactName.trim() && !selectedContact) || !selectedChannel || isStartingConversation || isCreatingContact}
                  className="w-full py-3.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-40"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>{isStartingConversation || isCreatingContact ? 'Criando…' : 'Criar Conversa / Iniciar Atendimento'}</span>
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
                      {contactNotes.notes.length} nota(s) registradas
                    </span>
                  </div>

                  {/* New Note Input */}
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
                      disabled={!selectedContact || !newNoteInput.trim() || contactNotes.isCreatingNote}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      {contactNotes.isCreatingNote ? 'Adicionando…' : 'Adicionar'}
                    </button>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {contactNotes.status === 'loading' ? (
                      <div className="p-6 text-center text-xs text-[#8696a0] border border-dashed rounded-xl bg-black/5 dark:bg-white/5">
                        Carregando notas deste contato…
                      </div>
                    ) : contactNotes.status === 'error' ? (
                      <div className="p-6 text-center text-xs text-red-500 border border-dashed rounded-xl bg-black/5 dark:bg-white/5 space-y-3">
                        <p>{contactNotes.error}</p>
                        <button type="button" onClick={() => void contactNotes.retry()} className="font-bold text-[#00a884] hover:underline">Tentar novamente</button>
                      </div>
                    ) : contactNotes.notes.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#8696a0] border border-dashed rounded-xl bg-black/5 dark:bg-white/5">
                        Nenhuma nota interna adicionada ainda.
                      </div>
                    ) : (
                      contactNotes.notes.map((note) => (
                        <div
                          key={note.id}
                          className={`p-3 rounded-xl border flex items-start justify-between space-x-3 ${
                            isDarkMode
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium whitespace-pre-wrap">{note.content}</p>
                            <span className="text-[10px] opacity-75 mt-1 block">
                              {note.authorName || 'Equipe'} • {new Date(note.createdAt * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-black/5 dark:border-white/5 text-[11px] text-[#8696a0] flex items-center space-x-2">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>As notas são mantidas de forma privada para a equipe e visíveis nos atendimentos.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 ${
              isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 rounded-full bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="font-bold text-base">Excluir todos os contatos</h3>
            </div>
            <p className="text-xs text-[#8696a0] leading-relaxed">
              Tem certeza de que deseja excluir todos os contatos listados? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  isDarkMode
                    ? 'bg-[#202c33] text-gray-300 hover:bg-[#2a3942]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAllContacts}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-md transition-colors"
              >
                Sim, excluir todos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Labels Modal */}
      {showBatchTagsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 ${
              isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center space-x-2 text-[#00a884]">
              <Tag className="w-5 h-5" />
              <h3 className="font-bold text-base">{batchTagAction === 'add' ? 'Adicionar' : 'Remover'} etiquetas dos contatos</h3>
            </div>
            <p className="text-xs text-[#8696a0]">
              A etiqueta selecionada será {batchTagAction === 'add' ? 'adicionada aos' : 'removida dos'} {selectedContactIds.length} contato(s) selecionado(s).
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#8696a0] block mb-1 font-semibold">Etiqueta</label>
                <select
                  value={batchTagInput}
                  onChange={(e) => setBatchTagInput(e.target.value)}
                  disabled={isApplyingBatchTags || contactLabels.status !== 'ready'}
                  className={`w-full px-3 py-2 rounded-xl border outline-none ${
                    isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-[#f0f2f5] border-[#d1d7db] text-black'
                  }`}
                >
                  <option value="">Selecionar etiqueta…</option>
                  {contactLabels.availableLabels.map((label) => (
                    <option key={label.id} value={label.title}>{label.title}</option>
                  ))}
                </select>
              </div>

              {contactLabels.status === 'loading' && <p className="text-[#8696a0]">Carregando etiquetas reais…</p>}
              {contactLabels.status === 'error' && (
                <div className="text-red-500 space-y-1"><p>{contactLabels.error}</p><button type="button" onClick={() => void contactLabels.retry()} className="font-bold text-[#00a884] hover:underline">Tentar novamente</button></div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchTagsModal(false)}
                disabled={isApplyingBatchTags}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  isDarkMode ? 'bg-[#202c33] text-gray-300 hover:bg-[#2a3942]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleApplyBatchTags()}
                disabled={!batchTagInput || isApplyingBatchTags || contactLabels.status !== 'ready'}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#00a884] hover:bg-[#008069] text-white cursor-pointer shadow-md transition-colors disabled:opacity-40"
              >
                {isApplyingBatchTags ? 'Enviando…' : batchTagAction === 'add' ? 'Adicionar etiqueta' : 'Remover etiqueta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 ${
              isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 rounded-full bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="font-bold text-base">Excluir {selectedContactIds.length} contato(s)</h3>
            </div>
            <p className="text-xs text-[#8696a0] leading-relaxed">
              Tem certeza de que deseja excluir os {selectedContactIds.length} contato(s) selecionado(s)? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirmModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  isDarkMode ? 'bg-[#202c33] text-gray-300 hover:bg-[#2a3942]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-md transition-colors"
              >
                Sim, excluir {selectedContactIds.length} contato(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Context Menu for Contacts */}
      <ContextMenu
        x={menuState.x}
        y={menuState.y}
        isOpen={menuState.isOpen}
        onClose={closeContextMenu}
        items={menuState.items}
        title={menuState.title}
        isDarkMode={isDarkMode}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={removeToast}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
