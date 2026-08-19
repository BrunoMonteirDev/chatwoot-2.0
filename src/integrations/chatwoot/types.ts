export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: string;
  client: string;
  expiry: string;
  uid: string;
}

export interface ChatwootAccountDto {
  id: number;
  name: string;
  status: string;
  onboarding_step: string | null;
  active_at: number | null;
  role: string;
  permissions: string[] | null;
  availability: string | null;
  availability_status: string | null;
  auto_offline: boolean;
  api_and_webhooks: boolean;
}

export interface ChatwootProfileDto {
  account_id: number | null;
  avatar_url: string | null;
  display_name: string | null;
  email: string;
  id: number;
  name: string;
  pubsub_token: string;
  role: string | null;
  type?: string | null;
  uid: string;
  accounts: ChatwootAccountDto[];
}

export interface ChatwootLoginResponse {
  data: ChatwootProfileDto;
}

export interface MfaRequiredResponse {
  mfa_required: true;
  mfa_token: string;
}

export interface MfaVerificationCredentials {
  mfaToken: string;
  otpCode?: string;
  backupCode?: string;
}

export interface ChatwootInboxDto {
  id: number;
  name: string;
  avatar_url: string | null;
  channel_type: string;
  channel_id?: number | null;
  webhook_url?: string | null;
  inbox_identifier?: string | null;
  additional_attributes?: Record<string, unknown> | null;
}

export interface ChatwootInboxesResponse {
  payload: ChatwootInboxDto[];
}

interface ChatwootContactSummaryDto { id?: number; name?: string; thumbnail?: string | null; additional_attributes?: Record<string, unknown> | null; }
interface ChatwootMessagePreviewDto { content?: string | null; message_type?: number; private?: boolean; attachments?: unknown[]; }
interface ChatwootAgentSummaryDto { id?: number; name?: string; available_name?: string; }
interface ChatwootTeamSummaryDto { id?: number; name?: string; }

export interface ChatwootConversationDto {
  id: number;
  inbox_id: number;
  status: string;
  priority: string | null;
  unread_count: number;
  updated_at?: number;
  last_activity_at: number;
  labels: string[];
  messages: ChatwootMessagePreviewDto[];
  meta: { sender?: ChatwootContactSummaryDto; channel?: string | null; assignee?: ChatwootAgentSummaryDto; team?: ChatwootTeamSummaryDto };
}

export interface ChatwootContactDto {
  id: number;
  name?: string | null;
  thumbnail?: string | null;
  phone_number?: string | null;
  email?: string | null;
  identifier?: string | null;
  blocked?: boolean;
  last_activity_at?: number | null;
  created_at?: number | null;
  additional_attributes?: Record<string, unknown> | null;
  custom_attributes?: Record<string, unknown> | null;
}

export interface ChatwootContactResponse { payload: ChatwootContactDto; }
export interface ChatwootContactsResponse {
  meta: { count: number; current_page: number; };
  payload: ChatwootContactDto[];
}
export interface ChatwootContactNoteDto { id: number; content: string; created_at: number; user?: { name?: string; available_name?: string } | null; }

export interface ChatwootAgentDto { id: number; name?: string; available_name?: string; thumbnail?: string | null; }
export interface ChatwootAssignableAgentsResponse { payload: ChatwootAgentDto[]; }
export interface ChatwootTeamDto { id: number; name: string; }
export interface ChatwootLabelDto { id: number; title: string; color?: string | null; }
export interface ChatwootLabelsResponse { payload: ChatwootLabelDto[]; }
export interface ChatwootConversationLabelsResponse { payload: string[]; }
export interface ChatwootContactLabelsResponse { payload: string[]; }
export interface ChatwootStatusResponse { payload: { current_status: string; snoozed_until?: string | null; }; }

export interface ChatwootCannedResponseDto {
  id: number;
  short_code: string;
  content: string;
}

export interface ChatwootConversationsResponse {
  data: { meta: { mine_count: number; assigned_count: number; unassigned_count: number; all_count: number }; payload: ChatwootConversationDto[] };
}

export interface ChatwootContactConversationsResponse {
  payload: ChatwootConversationDto[];
}

export interface ChatwootAttachmentDto {
  id: number;
  file_type: string;
  data_url?: string | null;
  thumb_url?: string | null;
  extension?: string | null;
  content_type?: string | null;
  file_size?: number | null;
  fallback_title?: string | null;
}

export interface ChatwootMessageDto {
  id: number;
  conversation_id: number;
  content?: string | null;
  message_type: number;
  content_type: string | number;
  status?: string | number | null;
  private: boolean;
  created_at: number;
  updated_at?: number | null;
  content_attributes?: Record<string, unknown> | null;
  sender?: { name?: string; available_name?: string; thumbnail?: string | null } | null;
  attachments?: ChatwootAttachmentDto[] | null;
  echo_id?: string;
  source_id?: string | null;
}

export interface ChatwootMessagesResponse {
  meta: Record<string, unknown>;
  payload: ChatwootMessageDto[];
}
