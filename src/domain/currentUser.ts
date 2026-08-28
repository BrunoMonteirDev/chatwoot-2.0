export interface CurrentAccount {
  id: number;
  name: string;
  role: string;
  permissions: string[];
  availability: string | null;
}

export interface CurrentUser {
  id: number;
  name: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string | null;
  isSuperAdmin: boolean;
  apiAccessToken: string;
  phoneNumber: string | null;
  messageSignature: string | null;
  uiSettings: Record<string, unknown>;
  pubsubToken: string;
  accounts: CurrentAccount[];
  activeAccountId: number | null;
}

export interface Inbox {
  id: number;
  name: string;
  avatarUrl: string | null;
  channelType: string;
  channelId: number | null;
  webhookUrl: string | null;
  inboxIdentifier: string | null;
  additionalAttributes: Record<string, unknown>;
}

export interface ConversationSummary {
  id: number;
  inboxId: number;
  channelType: string | null;
  contactName: string;
  contactId: number | null;
  contactAvatarUrl: string | null;
  lastMessage: string;
  lastMessageByCurrentUser: boolean;
  lastActivityAt: number;
  updatedAt: number;
  unreadCount: number;
  status: string;
  priority: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  participantIds: number[];
  teamId: number | null;
  teamName: string | null;
  labels: string[];
  isGroup: boolean;
}

export interface ContactProfile {
  id: number;
  name: string;
  avatarUrl: string | null;
  phoneNumber: string | null;
  email: string | null;
  identifier: string | null;
  companyName: string | null;
  city: string | null;
  country: string | null;
  blocked: boolean;
  lastActivityAt: number | null;
  createdAt: number | null;
  additionalAttributes: Record<string, unknown>;
  customAttributes: Record<string, unknown>;
}

export interface ContactNote {
  id: number;
  content: string;
  authorName: string | null;
  createdAt: number;
}

export type ConversationStatus = 'open' | 'resolved' | 'pending' | 'snoozed';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent' | null;

export interface AssignableAgent {
  id: number;
  name: string;
  avatarUrl: string | null;
  email?: string | null;
  role?: string | null;
  availability?: string | null;
  customRoleId?: number | null;
}

export interface CustomRole {
  id: number;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface PermissionProfile {
  id: number;
  name: string;
  description: string | null;
  inboxPermissions: string[];
  systemPermissions: string[];
  isDefault: boolean;
}

export interface AgentPermissionAssignment {
  agentId: number;
  permissionProfileId: number | null;
  inboxes: Array<{ inboxId: number; inboxName: string; permissionProfileId: number | null }>;
}

export interface ConversationTeam {
  id: number;
  name: string;
}

export interface AccountLabel {
  id: number;
  title: string;
  color: string | null;
}

// Modelo interno para respostas rápidas. A UI não recebe o DTO Rails.
export interface CannedResponse {
  id: number;
  shortCode: string;
  content: string;
  attachment?: File | null;
  attachmentName?: string | null;
}

export type ConversationMessageKind = 'incoming' | 'outgoing' | 'private_note' | 'activity' | 'template';
export type ConversationAttachmentKind = 'image' | 'audio' | 'video' | 'file' | 'other';

export interface ConversationAttachment {
  id: number;
  kind: ConversationAttachmentKind;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  contentType: string | null;
  size: number | null;
}

export interface ConversationMessage {
  id: number;
  conversationId: number;
  kind: ConversationMessageKind;
  contentType: string;
  content: string;
  createdAt: number;
  updatedAt: number | null;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | null;
  echoId?: string;
  sourceId?: string | null;
  error?: string | null;
  senderName: string | null;
  senderEmail?: string | null;
  senderAvatarUrl: string | null;
  origin: 'platform' | 'mobile' | null;
  attachments: ConversationAttachment[];
  contentAttributes: Record<string, unknown>;
}
