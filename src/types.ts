export type NavTab = 'chats' | 'calls' | 'status' | 'channels' | 'communities' | 'tools' | 'broadcast' | 'media' | 'settings';

export interface MultiTenantAccount {
  id: string;
  name: string;
  role: string;
}

export type FilterCategory = 'minhas' | 'nao_atribuidas' | 'todos' | 'grupos';

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  title?: string;
  subtitle?: string;
  size?: string;
  pages?: string;
  previewUrl?: string;
}

export interface ReplyTo {
  id?: string;
  externalId?: string | null;
  senderName: string;
  text: string;
  color?: string;
  mediaPreviewUrl?: string;
}

export interface LinkPreview {
  domain: string;
  url: string;
  description?: string;
  title?: string;
}

export interface MessageReaction {
  emoji: string;
  senderId: string;
  transport: 'evolution' | 'waha' | 'meta_cloud';
  origin?: 'contact' | 'mobile' | 'platform';
}

export interface Message {
  id: string;
  sender: 'me' | 'them';
  senderName?: string;
  senderPhone?: string;
  senderIdentity?: string;
  senderColor?: string;
  senderEmail?: string;
  senderAvatarUrl?: string;
  origin?: 'platform' | 'mobile';
  text?: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
  dateLabel?: string; // e.g. 'segunda-feira', 'terça-feira'
  replyTo?: ReplyTo;
  linkPreview?: LinkPreview;
  attachments?: Attachment[];
  audioDuration?: string;
  audioAuthor?: string;
  audioPhone?: string;
  audioAvatar?: string;
  isPrivate?: boolean;
  isActivity?: boolean;
  isStarred?: boolean;
  reactions?: MessageReaction[];
  sourceId?: string | null;
  whatsappTransport?: 'evolution' | 'waha' | 'meta_cloud' | null;
  whatsappRemoteJid?: string | null;
  whatsappFromMe?: boolean | null;
  isEdited?: boolean;
  isRevoked?: boolean;
  isDeleted?: boolean;
  isTemplate?: boolean;
  whatsappPreviousContent?: string | null;
  isForwarded?: boolean;
}

export interface Tag {
  label: string;
  color?: string; // hex or tailwind class e.g. '#eab308' or 'bg-amber-500'
}

export interface Chat {
  id: string;
  inboxId?: number;
  name: string;
  avatar: string;
  avatarType?: 'initials' | 'image' | 'logo' | 'group';
  avatarBg?: string;
  initials?: string;
  lastMessage: string;
  lastMessageByMe?: boolean;
  time: string;
  createdAtRelative?: string; // e.g. "6m", "7m", "2h", "21d"
  lastMessageRelative?: string; // e.g. "now", "3m", "8m", "16m"
  channelName?: string; // e.g. "UniFatecie API Oficial"
  assignedAgent?: string; // e.g. "SUELI CARDOSO DA SILVA RESENDE"
  responsibleUserIds?: number[];
  tags?: Tag[]; // e.g. [{ label: 'comercial_unifatecie', color: 'bg-amber-500' }]
  pinned?: boolean;
  isPinned?: boolean;
  muted?: boolean;
  unreadCount?: number;
  isGroup?: boolean;
  favorite?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  unassigned?: boolean;
  messages: Message[];
  membersCount?: number;
  about?: string;
  phone?: string;
  email?: string;
  identifier?: string;
  countryName?: string;
  city?: string;
  company?: string;
  createdAt?: string;
  lastActivityAt?: string;
  sourceLink?: string;
  isBlocked?: boolean;
  description?: string;
  notes?: { id: string; text: string; date: string; author?: string }[];
  status?: 'aberta' | 'pendente' | 'resolvida' | 'adiada';
  priority?: 'alta' | 'media' | 'baixa' | 'urgente';
  teamName?: string;
  campaignName?: string;
  pendingResponseDurationMinutes?: number;
}

export type ChatStatusFilter = 'todas' | 'abertas' | 'abertas_pendentes' | 'resolvidas' | 'pendentes' | 'adiadas';
export type ChatPriorityFilter = 'todas' | 'alta' | 'media' | 'baixa' | 'urgente';

export type ChatFilterField =
  | 'status'
  | 'priority'
  | 'assignedAgent'
  | 'inbox'
  | 'team'
  | 'identifier'
  | 'campaign';

export type ChatFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'present'
  | 'not_present';

export interface ChatFilterRule {
  id: string;
  field: ChatFilterField;
  operator: ChatFilterOperator;
  value: string;
}

export type ChatSortOption =
  | 'last_activity_desc'
  | 'last_activity_asc'
  | 'created_at_desc'
  | 'created_at_asc'
  | 'priority_desc'
  | 'priority_asc'
  | 'priority_and_created'
  | 'pending_long_first'
  | 'pending_short_first';

export interface UserProfile {
  name: string;
  phone: string;
  about: string;
  avatar: string;
}

export interface StatusItem {
  id: string;
  userName: string;
  userAvatar: string;
  time: string;
  hasUnseen: boolean;
  stories: {
    id: string;
    type: 'image' | 'text';
    content: string;
    bgColor?: string;
    caption?: string;
    time: string;
  }[];
}

export interface CallLog {
  id: string;
  name: string;
  avatar: string;
  time: string;
  type: 'incoming' | 'outgoing' | 'missed';
  isVideo: boolean;
}

export interface QuickResponse {
  id: string;
  shortcut: string;
  message: string;
  category?: string;
}
