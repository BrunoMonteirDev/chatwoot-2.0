import React from 'react';
import {
  Eye,
  Edit2,
  Copy,
  Trash2,
  Share2,
  Download,
  Printer,
  History,
  Star,
  CheckCircle,
  MessageSquare,
  VolumeX,
  Volume2,
  Pin,
  Archive,
  User,
  Phone,
  Mail,
  MoreHorizontal,
  CornerUpRight,
  Sparkles,
  Lock,
  Tag,
  Ban,
  RefreshCw,
  CopyPlus,
  SlidersHorizontal,
  SmilePlus,
} from 'lucide-react';
import { ContextMenuItem } from '../components/ContextMenu';
import { Chat, Message } from '../types';

export const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

/**
 * Builds context menu items for a Chat in the conversation list
 */
export function getChatContextMenuItems(
  chat: Chat,
  options: {
    onSelectChat: (chat: Chat) => void;
    onToggleUnread?: (chat: Chat) => void;
    onTogglePin?: (chat: Chat) => void;
    onToggleArchive?: (chat: Chat) => void;
    onToggleMute?: (chat: Chat) => void;
    onToggleFavorite?: (chat: Chat) => void;
    onOpenContactPanel?: (chat: Chat) => void;
    onDeleteChat?: (chat: Chat) => void;
    onDuplicateChat?: (chat: Chat) => void;
    onExportChat?: (chat: Chat) => void;
    onPrintChat?: (chat: Chat) => void;
  }
): ContextMenuItem[] {
  return [
    {
      label: 'Visualizar / Abrir Conversa',
      icon: <Eye />,
      action: () => options.onSelectChat(chat),
      shortcut: '↵',
    },
    {
      label: chat.unreadCount ? 'Marcar como Lida' : 'Marcar como Não Lida',
      icon: <CheckCircle />,
      action: () => options.onToggleUnread?.(chat),
    },
    {
      label: (chat.pinned || chat.isPinned) ? 'Desafixar Conversa' : 'Fixar Conversa no Topo',
      icon: <Pin />,
      action: () => options.onTogglePin?.(chat),
    },
    {
      label: (chat.favorite || chat.isFavorite) ? 'Remover dos Favoritos' : 'Favoritar Conversa',
      icon: <Star />,
      action: () => options.onToggleFavorite?.(chat),
    },
    { divider: true, label: '' },
    {
      label: 'Informações e Atributos do Contato',
      icon: <SlidersHorizontal />,
      action: () => options.onOpenContactPanel?.(chat),
    },
    {
      label: 'Copiar Telefone / Identificador',
      icon: <Copy />,
      action: () => {
        const text = chat.phone || chat.identifier || chat.name;
        navigator.clipboard.writeText(text);
      },
    },
    {
      label: 'Compartilhar Contato',
      icon: <Share2 />,
      action: () => {
        navigator.clipboard.writeText(`Contato: ${chat.name} (${chat.phone || 'Sem telefone'})`);
      },
    },
    {
      label: 'Duplicar Atendimento / Regra',
      icon: <CopyPlus />,
      action: () => options.onDuplicateChat?.(chat),
    },
    { divider: true, label: '' },
    {
      label: 'Exportar Histórico',
      icon: <Download />,
      action: () => options.onExportChat?.(chat),
    },
    {
      label: 'Imprimir Conversa',
      icon: <Printer />,
      action: () => options.onPrintChat?.(chat),
    },
    {
      label: 'Histórico Completo',
      icon: <History />,
      action: () => options.onSelectChat(chat),
    },
    { divider: true, label: '' },
    {
      label: 'Arquivar Conversa',
      icon: <Archive />,
      action: () => options.onToggleArchive?.(chat),
    },
    {
      label: 'Excluir Conversa',
      icon: <Trash2 />,
      danger: true,
      action: () => options.onDeleteChat?.(chat),
      shortcut: 'Del',
    },
  ];
}

/**
 * Builds context menu items for a Message in ChatArea
 */
export function getMessageContextMenuItems(
  msg: Message,
  options: {
    onReply?: (msg: Message) => void;
    onCopyText?: (msg: Message) => void;
    onDeleteMessage?: (msg: Message) => void;
    onEditMessage?: (msg: Message) => void;
    onRevokeMessage?: (msg: Message) => void;
    onReact?: (msg: Message, emoji: string) => void;
  }
): ContextMenuItem[] {
  return [
    {
      label: 'Responder Mensagem',
      icon: <CornerUpRight />,
      action: () => options.onReply?.(msg),
    },
    {
      label: 'Copiar Texto da Mensagem',
      icon: <Copy />,
      action: () => {
        if (msg.text) navigator.clipboard.writeText(msg.text);
        options.onCopyText?.(msg);
      },
      shortcut: 'Ctrl+C',
    },
    ...(options.onReact ? [
      { divider: true, label: '' },
      ...QUICK_REACTION_EMOJIS.map((emoji) => ({
        label: `Reagir ${emoji}`,
        icon: <SmilePlus />,
        action: () => options.onReact?.(msg, emoji),
      })),
    ] : []),
    ...(msg.sender === 'me' && msg.whatsappTransport === 'evolution' && !msg.isRevoked && !msg.attachments?.length ? [{
      label: 'Editar no WhatsApp', icon: <Edit2 />, action: () => options.onEditMessage?.(msg),
    }] : []),
    ...(msg.sender === 'me' && msg.whatsappTransport === 'evolution' && !msg.isRevoked ? [{
      label: 'Apagar para todos', icon: <Trash2 />, danger: true, action: () => options.onRevokeMessage?.(msg),
    }] : []),
    ...(msg.attachments?.length ? [{
      label: 'Baixar arquivo',
      icon: <Download />,
      action: () => {
        const attachment = msg.attachments?.[0];
        if (!attachment?.url) return;
        const link = document.createElement('a');
        link.href = attachment.url;
        link.download = attachment.title || 'anexo';
        link.rel = 'noopener';
        link.click();
      },
    }, { divider: true, label: '' }] : []),
    {
      label: 'Excluir somente aqui',
      icon: <Trash2 />,
      danger: true,
      action: () => options.onDeleteMessage?.(msg),
    },
  ];
}

/**
 * Builds context menu items for a Contact row/card in ContactsView
 */
export function getContactContextMenuItems(
  contact: Chat,
  options: {
    onViewContact: (contact: Chat) => void;
    onEditContact: (contact: Chat) => void;
    onDuplicateContact: (contact: Chat) => void;
    onDeleteContact: (contact: Chat) => void;
    onToggleBlock: (contact: Chat) => void;
    onExportContact: (contact: Chat) => void;
    onPrintContact: (contact: Chat) => void;
  }
): ContextMenuItem[] {
  return [
    {
      label: 'Visualizar Contato',
      icon: <Eye />,
      action: () => options.onViewContact(contact),
    },
    {
      label: 'Editar Dados do Contato',
      icon: <Edit2 />,
      action: () => options.onEditContact(contact),
    },
    {
      label: 'Duplicar Registro',
      icon: <CopyPlus />,
      action: () => options.onDuplicateContact(contact),
    },
    {
      label: 'Copiar Informações (Telefone/Email)',
      icon: <Copy />,
      action: () => {
        const str = `${contact.name} - ${contact.phone || ''} ${contact.email || ''}`;
        navigator.clipboard.writeText(str);
      },
    },
    { divider: true, label: '' },
    {
      label: 'Compartilhar Cartão de Visitas',
      icon: <Share2 />,
      action: () => {},
    },
    {
      label: 'Exportar Ficha em PDF / CSV',
      icon: <Download />,
      action: () => options.onExportContact(contact),
    },
    {
      label: 'Imprimir Relatório do Contato',
      icon: <Printer />,
      action: () => options.onPrintContact(contact),
    },
    {
      label: 'Histórico de Interações',
      icon: <History />,
      action: () => options.onViewContact(contact),
    },
    { divider: true, label: '' },
    {
      label: contact.isBlocked ? 'Desbloquear Contato' : 'Alterar Status / Bloquear',
      icon: <Ban />,
      action: () => options.onToggleBlock(contact),
    },
    {
      label: 'Excluir Contato Permanentemente',
      icon: <Trash2 />,
      danger: true,
      action: () => options.onDeleteContact(contact),
    },
  ];
}
