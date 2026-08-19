import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  MoreVertical,
  Plus,
  Smile,
  Mic,
  Send,
  SendHorizontal,
  Check,
  CheckCheck,
  CornerUpRight,
  ChevronDown,
  Play,
  Pause,
  FileText,
  Download,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  AtSign,
  Lock,
  Maximize2,
  Minimize2,
  Paperclip,
  Clock,
  CircleDot,
  CheckCircle,
  Bold,
  Italic,
  Strikethrough,
  Code,
  User,
  Sliders,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import { Chat, Message, Attachment, ReplyTo, LinkPreview, MessageReaction } from '../types';
import { WhatsAppDoodleBg, WallpaperId } from './WhatsAppDoodleBg';
import { EmojiPicker } from './EmojiPicker';
import { AttachmentMenu } from './AttachmentMenu';
import { SearchMessagesPanel } from './SearchMessagesPanel';
import { ContactAttributesPanel } from './ContactAttributesPanel';
import { QuickResponsesPopup } from './QuickResponsesPopup';
import { MentionsPopup, defaultGroupMembers, GroupMember } from './MentionsPopup';
import { ContextMenu } from './ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { getMessageContextMenuItems, QUICK_REACTION_EMOJIS } from '../utils/contextMenuActions';
import { ConversationManagementMenu } from './ConversationManagementMenu';
import { ContactDetailsPanel } from './ContactDetailsPanel';
import type { ConversationManagementCatalogs } from '../integrations/chatwoot/conversationManagement';
import type { ConversationPriority, ConversationStatus, ConversationSummary } from '../domain/currentUser';
import type { RealtimeConnectionStatus } from '../integrations/chatwoot/realtime';
import type { ContactNote, ContactProfile } from '../domain/currentUser';
import type { ContactUpdate } from '../integrations/chatwoot/contacts';
import { useCannedResponses } from '../features/cannedResponses/useCannedResponses';
import { MetaTemplatePicker } from './MetaTemplatePicker';


// Helper to format WhatsApp Markdown, URLs, Mentions, Bold (*), Italic (_), Strikethrough (~), Code (`)
const renderFormattedText = (content: string, depth = 0, isInputBackdrop = false): React.ReactNode[] => {
  if (!content || depth > 3) return [content];

  // Pattern for URLs, Code blocks/inline, @Mentions, Bold *...*, Italic _..._, Strikethrough ~...~
  const pattern = /(https?:\/\/[^\s]+)|(```[\s\S]+?```|`[^`\n]+`)|(@[\w\sÁ-ÿ]+?\b)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      elements.push(content.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const urlMatch = match[1];
    const codeMatch = match[2];
    const mentionMatch = match[3];
    const boldMatch = match[4];
    const italicMatch = match[5];
    const strikethroughMatch = match[6];

    const key = `${depth}-${match.index}-${fullMatch}`;

    if (urlMatch) {
      elements.push(
        <a
          key={key}
          href={urlMatch}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#53bdeb] hover:underline break-all font-normal"
        >
          {urlMatch}
        </a>
      );
    } else if (codeMatch) {
      const isTriple = codeMatch.startsWith('```') && codeMatch.endsWith('```');
      const symbol = isTriple ? '```' : '`';
      const cleanCode = isTriple ? codeMatch.slice(3, -3) : codeMatch.slice(1, -1);
      elements.push(
        <code
          key={key}
          className="font-mono bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[13px] font-normal"
        >
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">{symbol}</span>}
          {cleanCode}
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">{symbol}</span>}
        </code>
      );
    } else if (mentionMatch) {
      elements.push(
        <span
          key={key}
          className="font-semibold text-[#00a884] dark:text-[#00a884] cursor-pointer hover:underline"
        >
          {mentionMatch}
        </span>
      );
    } else if (boldMatch) {
      // Strip asterisks: *bold* -> bold
      const cleanBold = boldMatch.slice(1, -1);
      elements.push(
        <strong key={key} className="font-bold">
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">*</span>}
          {renderFormattedText(cleanBold, depth + 1, isInputBackdrop)}
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">*</span>}
        </strong>
      );
    } else if (italicMatch) {
      // Strip underscores: _italic_ -> italic
      const cleanItalic = italicMatch.slice(1, -1);
      elements.push(
        <em key={key} className="italic">
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">_</span>}
          {renderFormattedText(cleanItalic, depth + 1, isInputBackdrop)}
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">_</span>}
        </em>
      );
    } else if (strikethroughMatch) {
      // Strip tildes: ~strikethrough~ -> strikethrough
      const cleanStrike = strikethroughMatch.slice(1, -1);
      elements.push(
        <del key={key} className="line-through">
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">~</span>}
          {renderFormattedText(cleanStrike, depth + 1, isInputBackdrop)}
          {isInputBackdrop && <span className="opacity-0 font-normal select-none">~</span>}
        </del>
      );
    } else {
      elements.push(fullMatch);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    elements.push(content.slice(lastIndex));
  }

  if (isInputBackdrop && content.endsWith('\n')) {
    elements.push('\n ');
  }

  return elements;
};

// Sub-component to format text with @Mentions, URLs, WhatsApp markdown (*bold*, _italic_, ~strikethrough~, `code`), and "... Ler mais" truncation
const TextMessageContent: React.FC<{
  text: string;
  isDarkMode: boolean;
}> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 480;

  const isLongText = text.length > maxLength;
  const displayText = isLongText && !isExpanded ? text.slice(0, maxLength) : text;

  return (
    <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words pr-2">
      {renderFormattedText(displayText)}
      {isLongText && !isExpanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="ml-1 text-[#00a884] dark:text-[#00a884] font-semibold hover:underline cursor-pointer focus:outline-none inline-block"
        >
          ... Ler mais
        </button>
      )}
    </div>
  );
};

// Quoted reply message box
const QuotedReplyBox: React.FC<{
  replyTo: ReplyTo;
}> = ({ replyTo }) => {
  return (
    <div className="mb-2 p-2.5 rounded-r-lg rounded-tl-sm border-l-4 border-[#00a884] bg-black/20 dark:bg-black/30 border-r border-t border-b border-white/5 cursor-pointer hover:bg-black/30 transition-colors">
      <div className="text-xs font-semibold text-[#00a884] truncate">
        {replyTo.senderName}
      </div>
      <div className="text-xs text-[#8696a0] truncate mt-0.5">
        {replyTo.text}
      </div>
    </div>
  );
};

const MessageReactions: React.FC<{
  reactions: MessageReaction[];
  isDarkMode: boolean;
  onSelect: (emoji: string) => void;
}> = ({ reactions, isDarkMode, onSelect }) => {
  const grouped: Array<{ emoji: string; count: number; own: boolean }> = [];
  reactions.forEach((reaction) => {
    const group = grouped.find((item) => item.emoji === reaction.emoji);
    if (group) {
      group.count += 1;
      group.own ||= reaction.senderId === 'self';
    } else {
      grouped.push({ emoji: reaction.emoji, count: 1, own: reaction.senderId === 'self' });
    }
  });
  return (
    <div className="-mt-1 flex flex-wrap gap-1 px-1">
      {grouped.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={(event) => { event.stopPropagation(); onSelect(reaction.emoji); }}
          title={reaction.own ? 'Remover sua reação' : 'Reagir com este emoji'}
          className={`rounded-full border px-1.5 py-0.5 text-xs shadow-sm transition-colors ${reaction.own
            ? 'border-[#00a884] bg-[#00a884]/15'
            : isDarkMode ? 'border-[#37464f] bg-[#202c33] hover:bg-[#2a3942]' : 'border-[#d1d7db] bg-white hover:bg-[#f0f2f5]'}`}
        >
          <span>{reaction.emoji}</span>{reaction.count > 1 && <span className="ml-1 text-[10px] text-[#667781] dark:text-[#aebac1]">{reaction.count}</span>}
        </button>
      ))}
    </div>
  );
};

// Link Preview box
const LinkPreviewBox: React.FC<{
  linkPreview: LinkPreview;
}> = ({ linkPreview }) => {
  return (
    <div className="mb-2 p-2.5 rounded-r-lg border-l-4 border-[#00a884] bg-black/20 dark:bg-black/30 border-r border-t border-b border-white/5 space-y-1">
      <div className="text-xs font-semibold text-[#e9edef] truncate">
        {linkPreview.title || linkPreview.domain}
      </div>
      {linkPreview.description && (
        <div className="text-xs text-[#8696a0] line-clamp-2">
          {linkPreview.description}
        </div>
      )}
      <a
        href={linkPreview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-[#53bdeb] hover:underline break-all block"
      >
        {linkPreview.domain}
      </a>
    </div>
  );
};

// Document attachment card
const DocumentAttachmentCard: React.FC<{
  attachment: Attachment;
}> = ({ attachment }) => {
  return (
    <div className="my-1.5 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/20 dark:bg-black/35 shadow-xs transition-all hover:border-[#00a884]">
      {attachment.previewUrl && (
        <div className="h-28 w-full overflow-hidden bg-black/40 border-b border-white/10">
          <img
            src={attachment.previewUrl}
            alt={attachment.title || 'Document Preview'}
            className="w-full h-full object-cover object-top"
          />
        </div>
      )}
      <div className="p-3 flex items-center space-x-3 bg-black/10 dark:bg-black/20">
        <div className="w-10 h-11 bg-[#ef4444] text-white rounded-lg flex flex-col items-center justify-center font-black shadow-xs shrink-0">
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] uppercase tracking-tighter leading-none">PDF</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-[#e9edef] leading-snug">
            {attachment.title || 'documento.pdf'}
          </p>
          <p className="text-xs text-[#8696a0] truncate mt-0.5">
            {attachment.subtitle || `${attachment.pages || '3 páginas'} • PDF • ${attachment.size || '1 MB'}`}
          </p>
        </div>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors shrink-0"
          title="Baixar arquivo"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Voice / Audio Note Card
const AudioNoteCard: React.FC<{
  audioAuthor?: string;
  audioPhone?: string;
  audioDuration?: string;
  audioAvatar?: string;
  audioUrl?: string;
  isDarkMode: boolean;
  isMe?: boolean;
  time?: string;
}> = ({
  audioAuthor,
  audioPhone,
  audioDuration = '0:25',
  audioAvatar,
  audioUrl,
  isDarkMode,
  isMe = false,
  time,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<'1x' | '1.5x' | '2x'>('1.5x');

  // Realistic waveform height sequence (in px)
  const waveformHeights = [
    6, 12, 18, 22, 10, 16, 24, 14, 8, 20,
    16, 22, 26, 18, 12, 20, 24, 16, 10, 18,
    22, 14, 8, 16, 20, 12, 6, 14, 18, 10,
    6, 12
  ];

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      const step = playbackSpeed === '2x' ? 8 : playbackSpeed === '1.5x' ? 6 : 4;
      timer = setInterval(() => {
        setProgress((prev) => {
          if (prev + step >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + step;
        });
      }, 250);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed]);

  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playbackSpeed === '1x') setPlaybackSpeed('1.5x');
    else if (playbackSpeed === '1.5x') setPlaybackSpeed('2x');
    else setPlaybackSpeed('1x');
  };

  const formattedAuthor = audioAuthor
    ? audioAuthor.startsWith('~')
      ? audioAuthor
      : `~ ${audioAuthor}`
    : undefined;

  return (
    <div className="py-1 px-1 w-[260px] sm:w-[310px] max-w-full select-none font-sans">
      {/* Header: ~ Author Name (Yellow/Amber) + Phone Number (Gray) */}
      {(formattedAuthor || audioPhone) && (
        <div className="flex items-center justify-between text-xs font-semibold mb-2 px-0.5 min-w-0 overflow-hidden">
          <span className="text-[#ffd279] dark:text-[#f2b236] tracking-wide truncate mr-2">
            {formattedAuthor || '~ Contato'}
          </span>
          {audioPhone && (
            <span className="text-[#8696a0] text-[11px] font-normal shrink-0">
              {audioPhone}
            </span>
          )}
        </div>
      )}

      {/* Main Audio Player Row */}
      <div className="flex items-center space-x-2 my-1 w-full min-w-0">
        {/* Play / Pause button */}
        <button
          onClick={() => {
            if (!hasPlayed) setHasPlayed(true);
            if (!isPlaying && progress >= 98) {
              setProgress(0);
            }
            setIsPlaying(!isPlaying);
          }}
          className="p-1 text-white hover:opacity-80 transition-opacity shrink-0 focus:outline-none cursor-pointer"
          title={isPlaying ? 'Pausar' : 'Ouvir áudio'}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current text-white" />
          ) : (
            <Play className="w-5 h-5 fill-current text-white ml-0.5" />
          )}
        </button>

        {/* Green unread dot (shown until audio is played) */}
        {!hasPlayed && (
          <div
            onClick={() => {
              setHasPlayed(true);
              setIsPlaying(true);
            }}
            className="w-2.5 h-2.5 rounded-full bg-[#00a884] shrink-0 cursor-pointer hover:scale-125 transition-transform"
            title="Ouvir áudio"
          />
        )}

        {/* Waveform vertical bars container */}
        <div
          onClick={(e) => {
            if (!hasPlayed) setHasPlayed(true);
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newPct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
            setProgress(newPct);
          }}
          className="flex-1 min-w-0 flex items-center justify-between h-8 cursor-pointer px-1 group overflow-hidden"
          title="Navegar no áudio"
        >
          {waveformHeights.map((h, idx) => {
            const barPct = (idx / waveformHeights.length) * 100;
            const isActive = barPct <= progress;
            return (
              <div
                key={idx}
                style={{ height: `${h}px` }}
                className={`w-[2px] sm:w-[2.5px] rounded-full transition-colors duration-100 shrink-0 ${
                  isActive
                    ? 'bg-[#00a884]'
                    : isDarkMode
                    ? 'bg-[#54656f]'
                    : 'bg-[#8696a0]/60'
                }`}
              />
            );
          })}
        </div>

        {/* Right side: Speed Button Pill when played OR Avatar with Mic Badge when unplayed */}
        {hasPlayed ? (
          <button
            onClick={toggleSpeed}
            className="w-10 h-10 rounded-full bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef] text-xs font-bold shrink-0 cursor-pointer transition-all active:scale-95 border border-white/10 shadow-xs flex items-center justify-center ml-1"
            title="Alterar velocidade de reprodução (1x, 1.5x, 2x)"
          >
            {playbackSpeed}
          </button>
        ) : (
          <div
            onClick={() => {
              setHasPlayed(true);
              setIsPlaying(true);
            }}
            className="relative shrink-0 ml-1 cursor-pointer group"
            title="Clique para ouvir"
          >
            <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 shadow-xs bg-[#11283d] flex items-center justify-center">
              {audioAvatar ? (
                <img src={audioAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-xs">GP</span>
              )}
            </div>
            {/* Green Microphone Badge */}
            <div className="absolute -bottom-0.5 -left-1 w-4 h-4 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md border border-[#202c33]">
              <Mic className="w-2.5 h-2.5 fill-current stroke-[2.2]" />
            </div>
          </div>
        )}
      </div>
      {audioUrl && <audio controls preload="metadata" className="w-full mt-1 h-8" src={audioUrl}>Seu navegador não suporta áudio.</audio>}

      {/* Footer: duration on bottom-left, time on bottom-right */}
      <div className="flex justify-between items-center text-[11px] text-[#8696a0] font-sans mt-0.5 px-0.5">
        <span>{audioDuration}</span>
        <div className="flex items-center space-x-1 text-[11px] text-[#8696a0] ml-auto">
          <span>{time || '08:40'}</span>
          {isMe && (
            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline-block ml-0.5" />
          )}
        </div>
      </div>
    </div>
  );
};

interface Props {
  chat: Chat;
  allChats?: Chat[];
  onSelectChat?: (chat: Chat) => void;
  onSendMessage: (chatId: string, text: string, attachments?: File[], isPrivate?: boolean, replyTo?: ReplyTo | null) => void | Promise<boolean | void>;
  onImageClick: (url: string, title?: string, subtitle?: string) => void;
  onSearchInChat: () => void;
  isDarkMode?: boolean;
  wallpaperId?: WallpaperId;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onMobileBack?: () => void;
  historyStatus?: 'idle' | 'loading' | 'ready' | 'error';
  historyError?: string | null;
  hasOlderMessages?: boolean;
  isLoadingOlder?: boolean;
  onRetryHistory?: () => void;
  onLoadOlderMessages?: () => void;
  onRetryMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
  onEditMessage?: (messageId: string, content: string) => Promise<boolean>;
  onRevokeMessage?: (messageId: string) => Promise<boolean>;
  onReactMessage?: (messageId: string, emoji: string) => Promise<boolean> | boolean;
  conversation?: ConversationSummary | null;
  managementCatalogs?: ConversationManagementCatalogs;
  managementCatalogStatus?: 'idle' | 'loading' | 'ready' | 'error';
  managementCatalogError?: string | null;
  managementPendingAction?: string | null;
  onRetryManagementCatalogs?: () => void;
  onSetConversationStatus?: (status: ConversationStatus) => void;
  onSetConversationPriority?: (priority: ConversationPriority) => void;
  onAssignConversationAgent?: (agentId: number | null) => void;
  onAssignConversationTeam?: (teamId: number | null) => void;
  onSetConversationLabels?: (labels: string[]) => void;
  onMarkConversationRead?: () => void;
  onMarkConversationUnread?: () => void;
  onReachLatestMessage?: () => void;
  realtimeConnectionStatus?: RealtimeConnectionStatus;
  typingName?: string | null;
  contact?: ContactProfile | null;
  contactNotes?: ContactNote[];
  contactStatus?: 'idle' | 'loading' | 'ready' | 'error';
  contactError?: string | null;
  isContactSaving?: boolean;
  isCreatingContactNote?: boolean;
  onRetryContact?: () => void;
  onUpdateContact?: (update: ContactUpdate) => Promise<ContactProfile | null>;
  onCreateContactNote?: (content: string) => Promise<ContactNote | null>;
  accountId?: number | null;
}

export const ChatArea: React.FC<Props> = ({
  chat,
  allChats = [],
  onSelectChat,
  onSendMessage,
  onImageClick,
  onSearchInChat,
  isDarkMode = false,
  wallpaperId,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onMobileBack,
  historyStatus = 'ready',
  historyError,
  hasOlderMessages = false,
  isLoadingOlder = false,
  onRetryHistory,
  onLoadOlderMessages,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onRevokeMessage,
  onReactMessage,
  conversation,
  managementCatalogs,
  managementCatalogStatus = 'idle' as const,
  managementCatalogError = null,
  managementPendingAction = null,
  onRetryManagementCatalogs,
  onSetConversationStatus,
  onSetConversationPriority,
  onAssignConversationAgent,
  onAssignConversationTeam,
  onSetConversationLabels,
  onMarkConversationRead,
  onMarkConversationUnread,
  onReachLatestMessage,
  realtimeConnectionStatus = 'disconnected',
  typingName,
  contact,
  contactNotes = [],
  contactStatus = 'idle' as const,
  contactError = null,
  isContactSaving = false,
  isCreatingContactNote = false,
  onRetryContact,
  onUpdateContact,
  onCreateContactNote,
  accountId = null,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [contactPanelTab, setContactPanelTab] = useState<'contact' | 'attributes'>('contact');
  const [inputText, setInputText] = useState('');
  const [messageMode, setMessageMode] = useState<'responder' | 'privada'>('responder');
  const [ticketStatus, setTicketStatus] = useState<'resolver' | 'resolvido' | 'adiado' | 'pendente'>('resolver');
  const [showResolverMenu, setShowResolverMenu] = useState(false);
  const [isExpandedInput, setIsExpandedInput] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const sendingDraftsRef = useRef(new Set<string>());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const currentStatus = conversation?.status || (ticketStatus === 'resolver' ? 'open' : ticketStatus === 'resolvido' ? 'resolved' : ticketStatus === 'adiado' ? 'snoozed' : 'pending');
  const isManagingConversation = managementPendingAction !== null;
  const setConversationStatus = (status: ConversationStatus) => {
    if (conversation && onSetConversationStatus) onSetConversationStatus(status);
    else setTicketStatus(status === 'open' ? 'resolver' : status === 'resolved' ? 'resolvido' : status === 'snoozed' ? 'adiado' : 'pendente');
    setShowResolverMenu(false);
  };

  // Mentions State
  const [showMentionsPopup, setShowMentionsPopup] = useState(false);
  const [mentionFilterQuery, setMentionFilterQuery] = useState('');

  // Quick Responses State
  const [showQuickResponsesPopup, setShowQuickResponsesPopup] = useState(false);
  const [quickResponsesQuery, setQuickResponsesQuery] = useState('');
  const cannedResponses = useCannedResponses(accountId, showQuickResponsesPopup, quickResponsesQuery);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

  // Context Menu State
  const { menuState, openContextMenu, closeContextMenu } = useContextMenu();
  const [messagePendingDeletion, setMessagePendingDeletion] = useState<Message | null>(null);
  const [messagePendingRevoke, setMessagePendingRevoke] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingText, setEditingText] = useState('');
  const [reactionFailureId, setReactionFailureId] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  // Actions are reflected directly in the UI; avoid persistent pop-up notices.
  const addToast = (_title: string, _type: 'success' | 'info' | 'error' = 'success') => undefined;

  const handleMessageContextMenu = (e: React.MouseEvent, msg: Message) => {
    const items = getMessageContextMenuItems(msg, {
      onReply: (m) => {
        setReplyTo({ id: m.id, senderName: m.sender === 'me' ? 'Você' : m.senderName || 'Contato', text: m.text || (m.attachments?.length ? 'Mídia' : 'Mensagem') });
        addToast('Respondendo à mensagem selecionada', 'info');
      },
      onCopyText: (m) => {
        const txt = m.text || (m.attachments?.[0]?.title ?? '');
        if (txt) {
          navigator.clipboard.writeText(txt);
          addToast('Texto da mensagem copiado para a área de transferência!');
        } else {
          addToast('Mensagem sem texto para copiar', 'error');
        }
      },
      onDeleteMessage: (m) => {
        setMessagePendingDeletion(m);
      },
      onEditMessage: (m) => { setEditingMessage(m); setEditingText(m.text || ''); },
      onRevokeMessage: (m) => setMessagePendingRevoke(m),
      onReact: (m, emoji) => void handleReaction(m, emoji),
    });

    openContextMenu(e, items, 'Ações da Mensagem');
  };

  const handleReaction = async (message: Message, emoji: string) => {
    const applied = await onReactMessage?.(message.id, emoji);
    if (applied === false) {
      setReactionFailureId(message.id);
      window.setTimeout(() => setReactionFailureId((current) => current === message.id ? null : current), 3_500);
    }
  };

  // Derived group members for mentions popup
  const groupMembers = React.useMemo(() => {
    const membersMap = new Map<string, GroupMember>();
    defaultGroupMembers.forEach((m) => membersMap.set(m.name.toLowerCase(), m));

    // Also include any message sender names in current chat
    chat.messages.forEach((msg) => {
      if (msg.senderName && msg.senderName !== 'me') {
        const key = msg.senderName.toLowerCase();
        if (!membersMap.has(key)) {
          membersMap.set(key, {
            id: `msg-sender-${msg.senderName}`,
            name: msg.senderName,
          });
        }
      }
    });

    return Array.from(membersMap.values());
  }, [chat]);

  const handleSelectMention = (mentionName: string) => {
    const lastAtIndex = inputText.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const before = inputText.slice(0, lastAtIndex);
      setInputText(`${before}@${mentionName} `);
    } else {
      setInputText((prev) => `${prev}@${mentionName} `);
    }
    setShowMentionsPopup(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };


  // Scroll and unread badge state
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const applyFormattingSymbol = (symbol: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = inputText.substring(start, end);

    const symLen = symbol.length;
    let newText = '';
    let newStart = start;
    let newEnd = end;

    // Check if selectedText is directly wrapped in symbol e.g. *texto*
    if (
      selectedText.length >= symLen * 2 &&
      selectedText.startsWith(symbol) &&
      selectedText.endsWith(symbol)
    ) {
      // Unwrap selectedText
      const unwrapped = selectedText.slice(symLen, -symLen);
      newText = inputText.substring(0, start) + unwrapped + inputText.substring(end);
      newStart = start;
      newEnd = start + unwrapped.length;
    }
    // Check if characters surrounding selection are symbol e.g. |texto| with * before & after
    else if (
      start >= symLen &&
      end + symLen <= inputText.length &&
      inputText.substring(start - symLen, start) === symbol &&
      inputText.substring(end, end + symLen) === symbol
    ) {
      // Unwrap surrounding
      newText = inputText.substring(0, start - symLen) + selectedText + inputText.substring(end + symLen);
      newStart = start - symLen;
      newEnd = end - symLen;
    } else {
      // Wrap text
      if (selectedText) {
        newText = inputText.substring(0, start) + `${symbol}${selectedText}${symbol}` + inputText.substring(end);
        newStart = start;
        newEnd = end + symLen * 2;
      } else {
        newText = inputText.substring(0, start) + `${symbol}${symbol}` + inputText.substring(end);
        newStart = start + symLen;
        newEnd = start + symLen;
      }
    }

    setInputText(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newStart, newEnd);
      }
    }, 10);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, isExpandedInput ? 300 : 140);
      textareaRef.current.style.height = `${newHeight}px`;
      if (backdropRef.current) {
        backdropRef.current.style.height = `${newHeight}px`;
        backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      }
    }
  }, [inputText, isExpandedInput]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const playbackTimerRef = useRef<any>(null);
  const prevMessagesLength = useRef(chat.messages.length);
  const previousChatId = useRef(chat.id);
  const previousScrollHeight = useRef<number | null>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
    setIsUserScrolledUp(false);
    setUnreadBelowCount(0);
    onReachLatestMessage?.();
  };

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 80) {
      setIsUserScrolledUp(true);
    } else {
      setIsUserScrolledUp(false);
      setUnreadBelowCount(0);
      onReachLatestMessage?.();
    }
    if (el.scrollTop < 80 && hasOlderMessages && !isLoadingOlder && onLoadOlderMessages) {
      previousScrollHeight.current = el.scrollHeight;
      onLoadOlderMessages();
    }
  };

  // New incoming messages never move an agent who is reading older content.
  // The floating button below is the explicit WhatsApp-like notification.
  useEffect(() => {
    if (previousChatId.current !== chat.id) {
      previousChatId.current = chat.id;
      prevMessagesLength.current = chat.messages.length;
      return;
    }
    const isNewMessage = chat.messages.length > prevMessagesLength.current;
    prevMessagesLength.current = chat.messages.length;

    const lastMessage = chat.messages[chat.messages.length - 1];

    if (!lastMessage) return;

    if (lastMessage.sender === 'me') {
      scrollToBottom();
    } else if (isNewMessage) {
      if (isUserScrolledUp) {
        setUnreadBelowCount((prev) => prev + 1);
      } else {
        scrollToBottom();
      }
    }
  }, [chat.id, chat.messages, isUserScrolledUp]);

  // Preserve the visible message when an older page is prepended.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || previousScrollHeight.current === null || isLoadingOlder) return;
    el.scrollTop += el.scrollHeight - previousScrollHeight.current;
    previousScrollHeight.current = null;
  }, [chat.messages, isLoadingOlder]);

  // When active chat changes, reset scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [chat.id]);

  // Voice recording timer
  useEffect(() => {
    if (isRecordingVoice && !isRecordingPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecordingVoice, isRecordingPaused]);

  // Audio preview playback animation timer (when recording is paused)
  useEffect(() => {
    if (isPreviewPlaying) {
      const totalDuration = recordingTime || 1;
      const intervalMs = 100;
      const step = 100 / (totalDuration * 10);
      playbackTimerRef.current = setInterval(() => {
        setPreviewProgress((prev) => {
          if (prev >= 100) {
            setIsPreviewPlaying(false);
            return 0;
          }
          return prev + step;
        });
      }, intervalMs);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPreviewPlaying, recordingTime]);

  const handleCancelRecording = () => {
    recordingCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
    setIsRecordingVoice(false);
    setIsRecordingPaused(false);
    setIsPreviewPlaying(false);
    setPreviewProgress(0);
    setRecordingTime(0);
  };

  const sendRecordedAudio = (file: File) => {
    setIsSendingMessage(true);
    void Promise.resolve(onSendMessage(chat.id, '', [file], messageMode === 'privada', replyTo)).then((sent) => {
      if (sent === false) addToast('Não foi possível enviar o áudio.', 'error');
    }).catch(() => addToast('Não foi possível enviar o áudio.', 'error')).finally(() => setIsSendingMessage(false));
  };

  const handleStartRecording = async () => {
    setRecordingError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Este navegador não oferece gravação. Envie um arquivo de áudio pelo clipe.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingCancelledRef.current = false;
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (recordingCancelledRef.current || recordingChunksRef.current.length === 0) return;
        const type = recorder.mimeType || 'audio/webm';
        const extension = type.includes('ogg') ? 'ogg' : 'webm';
        sendRecordedAudio(new File([new Blob(recordingChunksRef.current, { type })], `audio-${Date.now()}.${extension}`, { type }));
      };
      recorder.start();
      setIsRecordingVoice(true);
      setIsRecordingPaused(false);
      setIsPreviewPlaying(false);
      setPreviewProgress(0);
      setRecordingTime(0);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      const details = cause instanceof Error ? cause.message : '';
      const message = name === 'NotAllowedError' || name === 'SecurityError'
        ? 'O navegador bloqueou o microfone.'
        : name === 'NotFoundError'
          ? 'Nenhum microfone foi encontrado no computador.'
          : name === 'NotReadableError'
            ? 'O microfone está sendo usado por outro aplicativo ou navegador.'
            : 'Não foi possível iniciar a gravação de áudio.';
      setRecordingError(`${message}${details ? ` (${name}: ${details})` : ''} Você também pode enviar um arquivo de áudio pelo clipe.`);
    }
  };

  const handleSend = () => {
    if ((!inputText.trim() && selectedFiles.length === 0) && !isRecordingVoice || isSendingMessage) return;

    if (isRecordingVoice) {
      setIsRecordingVoice(false);
      setIsRecordingPaused(false);
      setIsPreviewPlaying(false);
      setPreviewProgress(0);

      mediaRecorderRef.current?.stop();
      setRecordingTime(0);
      return;
    }

    const content = inputText.trim();
    const files = selectedFiles;
    const draftKey = `${chat.id}:${messageMode}:${content}:${files.map((file) => `${file.name}:${file.size}`).join('|')}`;
    if (sendingDraftsRef.current.has(draftKey)) return;
    const submission = onSendMessage(chat.id, content, files, messageMode === 'privada', replyTo);
    if (submission && typeof (submission as Promise<void>).then === 'function') {
      sendingDraftsRef.current.add(draftKey);
      setIsSendingMessage(true);
      void Promise.resolve(submission).then((sent) => {
        if (sent !== false) {
          setInputText('');
          setSelectedFiles([]);
          setShowEmojiPicker(false);
          setReplyTo(null);
        }
      }).finally(() => {
        sendingDraftsRef.current.delete(draftKey);
        setIsSendingMessage(false);
      });
      return;
    }
    setInputText('');
    setSelectedFiles([]);
    setShowEmojiPicker(false);
    setReplyTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const isCmdOrCtrl = e.ctrlKey || e.metaKey;

    // Formatting shortcuts: Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+Shift+X / Ctrl+Shift+S (Strikethrough), Ctrl+Shift+C (Code)
    if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      applyFormattingSymbol('*');
      return;
    }
    if (isCmdOrCtrl && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      applyFormattingSymbol('_');
      return;
    }
    if (
      (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'x') ||
      (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 's') ||
      (isCmdOrCtrl && e.key.toLowerCase() === 'u')
    ) {
      e.preventDefault();
      applyFormattingSymbol('~');
      return;
    }
    if (
      (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'c') ||
      (isCmdOrCtrl && e.key.toLowerCase() === 'e') ||
      (isCmdOrCtrl && e.key.toLowerCase() === 'k')
    ) {
      e.preventDefault();
      applyFormattingSymbol('`');
      return;
    }

    if ((e.key === 'Enter' && isCmdOrCtrl) || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) setSelectedFiles((current) => [...current, ...files]);
    e.target.value = '';
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex-1 flex flex-row h-full relative overflow-hidden">
      {/* Main Active Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Hidden File Input for uploading custom media */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />

      {/* Chat Header */}
      <div
        className={`h-14 px-4 flex items-center justify-between border-b z-20 flex-shrink-0 select-none transition-colors ${
          isDarkMode
            ? 'bg-[#151717] border-[#1e1f1f] text-[#e9edef]'
            : 'bg-[#f0f2f5] border-[#d1d7db] text-[#111b21]'
        }`}
      >
        <div
          onClick={() => {
            setIsContactPanelOpen((prev) => {
              const next = !prev;
              if (next) setIsSearchOpen(false);
              return next;
            });
          }}
          className="flex items-center space-x-2 sm:space-x-3 cursor-pointer min-w-0 flex-1"
        >
          {/* Mobile Back Button */}
          {onMobileBack && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMobileBack();
              }}
              title="Voltar para as conversas"
              className={`p-1.5 -ml-1 rounded-full transition-colors shrink-0 cursor-pointer md:hidden ${
                isDarkMode
                  ? 'text-[#aebac1] hover:bg-[#2a3942]'
                  : 'text-[#54656f] hover:bg-[#e9edef]'
              }`}
            >
              <ArrowLeft className="w-5 h-5 text-[#8696a0]" />
            </button>
          )}

          {/* Sidebar Toggle Button */}
          {onToggleSidebar && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSidebar();
              }}
              title={isSidebarCollapsed ? 'Expandir lista de conversas' : 'Recolher lista de conversas'}
              className={`hidden md:flex p-1.5 rounded-full transition-colors shrink-0 cursor-pointer ${
                isDarkMode
                  ? 'text-[#aebac1] hover:bg-[#2a3942]'
                  : 'text-[#54656f] hover:bg-[#e9edef]'
              }`}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-[#00a884]" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-[#8696a0]" />
              )}
            </button>
          )}

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#2563eb]">
            {chat.avatarType === 'image' && chat.avatar ? (
              <img
                src={chat.avatar}
                alt={chat.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : chat.avatarType === 'logo' ? (
              <div
                className="w-full h-full flex items-center justify-center text-white font-bold text-base"
                style={{ backgroundColor: chat.avatarBg || '#2563eb' }}
              >
                {chat.avatar === 'X' ? 'X' : chat.avatar.substring(0, 2)}
              </div>
            ) : chat.avatarType === 'initials' ? (
              <div
                className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: chat.avatarBg || '#991b1b' }}
              >
                {chat.avatar}
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white text-base"
                style={{ backgroundColor: chat.avatarBg || '#4f46e5' }}
              >
                {chat.avatar || '👥'}
              </div>
            )}
          </div>

          {/* Name & Subtitle */}
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden mr-1">
            <h2
              className={`font-semibold text-sm sm:text-[15px] leading-tight truncate ${
                isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
              }`}
            >
              {chat.name}
            </h2>
            <span
              className={`text-[11px] sm:text-xs leading-tight mt-0.5 truncate ${
                isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
              }`}
            >
              {typingName ? `${typingName} está digitando…` : chat.about || (chat.isGroup ? 'Clique para dados do grupo' : realtimeConnectionStatus === 'connected' ? 'online' : 'reconectando…')}
            </span>
          </div>
        </div>

        {/* Header Action Icons */}
        <div
          className={`flex items-center space-x-1 sm:space-x-2 shrink-0 ${
            isDarkMode ? 'text-[#aebac1]' : 'text-[#54656f]'
          }`}
        >
          {/* Resolver / Ticket Status Dropdown (Chatwoot Style) */}
          <div className="relative">
            <div
              className={`flex items-center rounded-lg overflow-hidden border transition-colors shadow-xs ${
                currentStatus === 'resolved'
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                  : currentStatus === 'snoozed'
                  ? 'bg-amber-600/20 border-amber-500/40 text-amber-400'
                  : currentStatus === 'pending'
                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                  : isDarkMode
                  ? 'bg-[#2a3942] border-[#374248] text-[#e9edef] hover:bg-[#32424b]'
                  : 'bg-[#e9edef] border-[#d1d7db] text-[#111b21] hover:bg-[#d1d7db]'
              }`}
            >
              <button
                type="button"
                disabled={isManagingConversation}
                onClick={() => setConversationStatus(currentStatus === 'open' ? 'resolved' : 'open')}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold flex items-center space-x-1 sm:space-x-1.5 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {currentStatus === 'resolved' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                {currentStatus === 'snoozed' && <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                {currentStatus === 'pending' && <CircleDot className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                <span className="capitalize">
                  {currentStatus === 'open'
                    ? 'Resolver'
                    : currentStatus === 'resolved'
                    ? 'Resolvido'
                    : currentStatus === 'snoozed'
                    ? 'Adiado'
                    : 'Pendente'}
                </span>
              </button>

              <div
                className={`w-[1px] h-4 ${
                  isDarkMode ? 'bg-white/10' : 'bg-black/10'
                }`}
              />

              <button
                type="button"
                disabled={isManagingConversation}
                onClick={() => setShowResolverMenu((prev) => !prev)}
                title="Opções do ticket"
                className="px-2 py-1.5 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center disabled:opacity-50"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Resolver Dropdown Popover */}
            {showResolverMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowResolverMenu(false)}
                />
                <div
                  className={`absolute right-0 top-full mt-1.5 z-50 w-48 rounded-xl border shadow-2xl p-1.5 animate-in fade-in duration-150 ${
                    isDarkMode
                      ? 'bg-[#182228] border-[#2a3942] text-[#e9edef]'
                      : 'bg-white border-[#d1d7db] text-[#111b21]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setConversationStatus('resolved')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      currentStatus === 'resolved'
                        ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                        : isDarkMode
                        ? 'hover:bg-[#2a3942] text-[#e9edef]'
                        : 'hover:bg-[#f0f2f5] text-[#111b21]'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Marcar como resolvido</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConversationStatus('snoozed')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      currentStatus === 'snoozed'
                        ? 'bg-amber-500/10 text-amber-400 font-semibold'
                        : isDarkMode
                        ? 'hover:bg-[#2a3942] text-[#e9edef]'
                        : 'hover:bg-[#f0f2f5] text-[#111b21]'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Adiar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConversationStatus('pending')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                      currentStatus === 'pending'
                        ? 'bg-blue-500/10 text-blue-400 font-semibold'
                        : isDarkMode
                        ? 'hover:bg-[#2a3942] text-[#e9edef]'
                        : 'hover:bg-[#f0f2f5] text-[#111b21]'
                    }`}
                  >
                    <CircleDot className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Deixar pendente</span>
                  </button>

                  {currentStatus !== 'open' && (
                    <button
                      type="button"
                      onClick={() => setConversationStatus('open')}
                      className={`w-full text-left px-3 py-2 mt-1 border-t rounded-lg text-xs font-medium flex items-center space-x-2.5 transition-colors cursor-pointer ${
                        isDarkMode
                          ? 'border-[#2a3942] hover:bg-[#2a3942] text-[#aebac1]'
                          : 'border-[#d1d7db] hover:bg-[#f0f2f5] text-[#54656f]'
                      }`}
                    >
                      <span>Reabrir conversa</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              setIsSearchOpen((prev) => !prev);
              if (onSearchInChat) onSearchInChat();
              if (isContactPanelOpen) setIsContactPanelOpen(false);
            }}
            title="Pesquisar na conversa"
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              isSearchOpen
                ? isDarkMode ? 'bg-[#2a3942] text-[#00a884]' : 'bg-[#e9edef] text-[#008069]'
                : isDarkMode ? 'hover:bg-[#2a3942]' : 'hover:bg-[#e9edef]'
            }`}
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setIsContactPanelOpen((prev) => !prev);
              if (isSearchOpen) setIsSearchOpen(false);
            }}
            title="Dados e Atributos do Contato"
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              isContactPanelOpen
                ? isDarkMode ? 'bg-[#2a3942] text-[#00a884]' : 'bg-[#e9edef] text-[#008069]'
                : isDarkMode ? 'hover:bg-[#2a3942]' : 'hover:bg-[#e9edef]'
            }`}
          >
            <User className="w-5 h-5" />
          </button>
          {conversation && managementCatalogs && onRetryManagementCatalogs && onSetConversationPriority && onAssignConversationAgent && onAssignConversationTeam && onSetConversationLabels && onMarkConversationRead && onMarkConversationUnread && (
            <ConversationManagementMenu
              conversation={conversation} catalogs={managementCatalogs} catalogStatus={managementCatalogStatus}
              catalogError={managementCatalogError} pendingAction={managementPendingAction}
              onRetryCatalogs={onRetryManagementCatalogs} onSetPriority={onSetConversationPriority}
              onAssignAgent={onAssignConversationAgent} onAssignTeam={onAssignConversationTeam}
              onSetLabels={onSetConversationLabels} onMarkRead={onMarkConversationRead} onMarkUnread={onMarkConversationUnread}
            />
          )}
          <span title={realtimeConnectionStatus === 'connected' ? 'Realtime conectado' : 'Realtime desconectado'} className={`h-2 w-2 rounded-full ${realtimeConnectionStatus === 'connected' ? 'bg-[#00a884]' : realtimeConnectionStatus === 'connecting' || realtimeConnectionStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-[#8696a0]'}`} />
        </div>
      </div>



      {/* Floating Right Dock Buttons (Contact & Attributes Panel Toggle) */}
      <div className="absolute right-3 top-20 z-20 flex flex-col items-center gap-1.5 p-1 rounded-2xl bg-[#222529]/90 dark:bg-[#182228]/95 backdrop-blur-md border border-white/10 shadow-2xl transition-all">
        {/* Button 1: Dados do contato / grupo */}
        <button
          type="button"
          onClick={() => {
            if (isContactPanelOpen && contactPanelTab === 'contact') {
              setIsContactPanelOpen(false);
            } else {
              setContactPanelTab('contact');
              setIsContactPanelOpen(true);
              setIsSearchOpen(false);
            }
          }}
          title="Dados do Contato / Grupo"
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            isContactPanelOpen && contactPanelTab === 'contact'
              ? 'bg-[#00a884] text-white shadow-md scale-105'
              : isDarkMode
              ? 'text-[#aebac1] hover:text-white hover:bg-white/10'
              : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/10'
          }`}
        >
          <User className="w-5 h-5" />
        </button>

        {/* Button 2: Informações e Atributos do Contato */}
        <button
          type="button"
          onClick={() => {
            if (isContactPanelOpen && contactPanelTab === 'attributes') {
              setIsContactPanelOpen(false);
            } else {
              setContactPanelTab('attributes');
              setIsContactPanelOpen(true);
              setIsSearchOpen(false);
            }
          }}
          title="Informações e Atributos do Contato"
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            isContactPanelOpen && contactPanelTab === 'attributes'
              ? 'bg-[#00a884] text-white shadow-md scale-105'
              : isDarkMode
              ? 'text-[#aebac1] hover:text-white hover:bg-white/10'
              : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/10'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>
      <WhatsAppDoodleBg isDarkMode={isDarkMode} wallpaperId={wallpaperId} />

      {/* Chat Messages Body - Scrollable */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:px-12 relative space-y-3 z-10"
      >
        {historyStatus === 'loading' && (
          <div className={`py-8 text-center text-sm ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>Carregando mensagens…</div>
        )}
        {historyStatus === 'error' && (
          <div className={`py-8 text-center text-sm ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
            <p>{historyError || 'Não foi possível carregar as mensagens.'}</p>
            {onRetryHistory && <button type="button" onClick={onRetryHistory} className="mt-3 text-[#00a884] hover:underline">Tentar novamente</button>}
          </div>
        )}
        {historyStatus === 'ready' && chat.messages.length === 0 && (
          <div className={`py-8 text-center text-sm ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>Esta conversa ainda não possui mensagens.</div>
        )}
        {isLoadingOlder && <div className={`py-2 text-center text-xs ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>Carregando mensagens anteriores…</div>}
        {chat.messages.map((msg, index) => {
          const isMe = msg.sender === 'me';
          const prevMsg = chat.messages[index - 1];
          const showDatePill =
            msg.dateLabel && (!prevMsg || prevMsg.dateLabel !== msg.dateLabel);

          return (
            <React.Fragment key={msg.id || index}>
              {/* Date Divider Pill */}
              {showDatePill && (
                <div className="flex justify-center my-4 relative z-10 select-none">
                  <span
                    className={`text-xs px-3 py-1 rounded-lg uppercase tracking-wider font-medium shadow-xs border ${
                      isDarkMode
                        ? 'bg-[#182229] text-[#8696a0] border-[#222d34]'
                        : 'bg-white/90 text-[#54656f] border-[#d1d7db]/50'
                    }`}
                  >
                    {msg.dateLabel}
                  </span>
                </div>
              )}

              {/* Message Bubble Container */}
              {msg.isActivity ? (
                <div className={`mx-auto max-w-[85%] rounded-lg px-3 py-1.5 text-center text-xs shadow-xs ${isDarkMode ? 'bg-[#182229] text-[#aebac1]' : 'bg-white/90 text-[#54656f]'}`}>
                  {msg.text || 'Evento da conversa'}
                </div>
              ) : <div
                id={`msg-${msg.id}`}
                className={`flex flex-col relative z-10 transition-colors duration-300 ${
                  isMe ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                  className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] w-fit rounded-lg px-3 py-1.5 shadow-xs relative group border select-none ${
                    (msg.audioAuthor || msg.attachments?.some((a) => a.type === 'audio'))
                      ? 'min-w-[270px] sm:min-w-[310px]'
                      : ''
                  } ${
                    msg.isPrivate
                      ? isDarkMode
                        ? 'bg-[#231b0c] border-[#6b5113] text-[#fef08a] rounded-tr-none'
                        : 'bg-[#fffbeb] border-[#fde68a] text-[#78350f] rounded-tr-none'
                      : isMe
                      ? isDarkMode
                        ? 'bg-[#005c4b] border-transparent text-[#e9edef] rounded-tr-none'
                        : 'bg-[#d9fdd3] border-transparent text-[#111b21] rounded-tr-none'
                      : isDarkMode
                      ? 'bg-[#202c33] border-transparent text-[#e9edef] rounded-tl-none'
                      : 'bg-white border-transparent text-[#111b21] rounded-tl-none'
                    }`}
                >
                  {!msg.isPrivate && onReactMessage && (
                    <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-0'} hidden group-hover:flex items-center gap-0.5 rounded-full border px-1 py-0.5 shadow-lg z-20 ${isDarkMode ? 'border-[#37464f] bg-[#202c33]' : 'border-[#d1d7db] bg-white'}`}>
                      {QUICK_REACTION_EMOJIS.map((emoji) => (
                        <button key={emoji} type="button" onClick={(event) => { event.stopPropagation(); void handleReaction(msg, emoji); }} className="rounded-full px-0.5 text-sm hover:bg-black/10" title={`Reagir ${emoji}`}>{emoji}</button>
                      ))}
                    </div>
                  )}
                  {/* Private Note Header Badge */}
                  {msg.isPrivate && (
                    <div className="flex items-center space-x-1.5 text-xs font-semibold pb-1 mb-1 border-b border-amber-500/20 text-amber-500 dark:text-amber-400">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>Mensagem Privada (Nota Interna)</span>
                    </div>
                  )}

                  {/* Sender Name in Group Chat (only if not an audio note card, which has its own header) */}
                  {!isMe && msg.senderName && !(msg.audioAuthor || msg.attachments?.some((a) => a.type === 'audio')) && (
                    <div
                      className={`text-xs font-semibold mb-1 ${
                        isDarkMode ? 'text-[#00a884]' : 'text-[#008069]'
                      }`}
                    >
                      {msg.senderName}
                    </div>
                  )}

                  {/* Quoted Reply Message */}
                  {msg.replyTo && <QuotedReplyBox replyTo={msg.replyTo} />}

                  {editingMessage?.id === msg.id ? <div className="mb-2 space-y-2"><textarea value={editingText} onChange={event => setEditingText(event.target.value)} rows={3} className="w-full rounded border border-[#00a884] bg-black/15 p-2 text-sm outline-none" /><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingMessage(null)} className="text-xs text-[#aebac1]">Cancelar</button><button type="button" disabled={!editingText.trim()} onClick={() => { const target = editingMessage; if (!target || !onEditMessage) return; void onEditMessage(target.id, editingText.trim()).then(ok => { if (ok) setEditingMessage(null); }); }} className="rounded bg-[#00a884] px-2 py-1 text-xs font-bold text-[#0b141a] disabled:opacity-50">Salvar</button></div></div> : null}

                  {/* Link Preview Card */}
                  {msg.linkPreview && <LinkPreviewBox linkPreview={msg.linkPreview} />}

                  {/* Audio Note Card */}
                  {(msg.audioAuthor || msg.attachments?.some((a) => a.type === 'audio')) && (
                    <AudioNoteCard
                      audioAuthor={msg.audioAuthor || (msg.sender === 'them' ? msg.senderName : undefined)}
                      audioPhone={msg.audioPhone || (msg.sender === 'them' ? '+55 44 9937-6314' : undefined)}
                      audioDuration={msg.audioDuration || '0:25'}
                      audioAvatar={msg.audioAvatar || (msg.sender === 'them' ? chat.avatar : undefined)}
                      audioUrl={msg.attachments?.find((attachment) => attachment.type === 'audio')?.url}
                      isDarkMode={isDarkMode}
                      isMe={isMe}
                      time={msg.time}
                    />
                  )}

                  {/* Image & Document Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-1 space-y-2">
                      {msg.attachments.map((att) => {
                        if (att.type === 'file') {
                          return <DocumentAttachmentCard key={att.id} attachment={att} />;
                        }
                        if (att.type === 'image') {
                          return (
                            <div
                              key={att.id}
                              onClick={() =>
                                onImageClick(att.url, att.title, att.subtitle)
                              }
                              className={`relative rounded-xl overflow-hidden border group/img cursor-pointer transition-all ${
                                isDarkMode
                                  ? 'border-[#2a3942] bg-[#111b21] hover:border-[#00a884]'
                                  : 'border-[#e9edef] bg-[#f0f2f5] hover:border-[#00a884]'
                              }`}
                            >
                              <img
                                src={att.url}
                                alt={att.title || 'Attachment'}
                                className="w-full max-h-64 object-cover object-top transition-transform group-hover/img:scale-102 duration-200"
                                referrerPolicy="no-referrer"
                              />
                              {/* Overlay button */}
                              <div className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity shadow-xs">
                                <CornerUpRight className="w-4 h-4" />
                              </div>
                              {att.title && (
                                <div
                                  className={`p-2 border-t ${
                                    isDarkMode
                                      ? 'bg-[#111b21]/95 border-[#202c33]'
                                      : 'bg-white/95 border-[#f0f2f5]'
                                  }`}
                                >
                                  <p
                                    className={`text-xs font-medium truncate ${
                                      isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
                                    }`}
                                  >
                                    {att.title}
                                  </p>
                                  {att.subtitle && (
                                    <p
                                      className={`text-[11px] truncate ${
                                        isDarkMode
                                          ? 'text-[#8696a0]'
                                          : 'text-[#667781]'
                                      }`}
                                    >
                                      {att.subtitle}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (att.type === 'video') {
                          return <video key={att.id} controls preload="metadata" className="w-full max-h-64 rounded-xl bg-black" src={att.url}>Seu navegador não suporta vídeo.</video>;
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Text Message Content */}
                  {msg.text && (
                    <TextMessageContent text={msg.text} isDarkMode={isDarkMode} />
                  )}

                  {/* Timestamp & Status Icon (for non-audio or mixed messages) */}
                  {(msg.text || !msg.attachments?.some((a) => a.type === 'audio')) && (
                    <div className="flex items-center justify-end space-x-1 float-right mt-1 ml-2 select-none">
                      <span
                        className={`text-[11px] font-normal leading-none ${
                          isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                        }`}
                      >
                        {msg.time}
                      </span>
                      {msg.isEdited && !msg.isRevoked && <span className="text-[10px] text-[#8696a0]">editada</span>}
                      {isMe && !msg.isPrivate && msg.origin && (
                        <span
                          title={msg.origin === 'mobile' ? 'Enviado pelo aparelho' : 'Enviado pela plataforma'}
                          aria-label={msg.origin === 'mobile' ? 'Enviado pelo aparelho' : 'Enviado pela plataforma'}
                          className="text-[10px] leading-none text-[#8696a0]"
                        >
                          {msg.origin === 'mobile' ? '◉' : '⌁'}
                        </span>
                      )}
                      {msg.isStarred && (
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400 ml-0.5" />
                      )}
                      {isMe && (
                        <span className="leading-none">
                          {msg.status === 'failed' ? (
                            <button type="button" onClick={() => onRetryMessage?.(msg.id)} className="text-red-400 hover:text-red-300 text-[11px] font-medium" title={msg.error || 'Falha no envio; tentar novamente'}>
                              Falhou · tentar novamente
                            </button>
                          ) : msg.status === 'sending' ? (
                            <Clock className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`} />
                          ) : msg.status === 'read' ? (
                            <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                          ) : (
                            <Check
                              className={`w-4 h-4 ${
                                isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                              }`}
                            />
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {msg.reactions && msg.reactions.length > 0 && (
                  <MessageReactions reactions={msg.reactions} isDarkMode={isDarkMode} onSelect={(emoji) => void handleReaction(msg, emoji)} />
                )}
                {reactionFailureId === msg.id && (
                  <div className="mt-1 px-1 text-[11px] text-red-400">Não foi possível enviar a reação.</div>
                )}
              </div>}
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {(isUserScrolledUp || unreadBelowCount > 0) && (
        <button
          onClick={scrollToBottom}
          title="Ir para a última mensagem"
          className={`absolute bottom-[68px] right-6 z-30 w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all transform active:scale-95 ${
            isDarkMode
              ? 'bg-[#202c33] hover:bg-[#2a3942] text-[#aebac1] border border-[#222d34]'
              : 'bg-white hover:bg-[#f0f2f5] text-[#54656f] border border-[#d1d7db]'
          }`}
        >
          <ChevronDown className="w-5 h-5" />
          {unreadBelowCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-white text-black font-extrabold text-[11px] rounded-full px-1.5 py-0.5 min-w-[20px] text-center shadow-md border border-gray-200 leading-none">
              {unreadBelowCount}
            </span>
          )}
        </button>
      )}

      {/* Bottom Message Input Bar - Floating Capsule */}
      <div className="px-3 pb-3 pt-1 z-20 flex-shrink-0 relative">
        {/* Attachment Options Popup */}
        {showAttachmentMenu && (
          <AttachmentMenu
            onSelectOption={(type) => {
              if (type === 'image' || type === 'document' || type === 'audio') {
                fileInputRef.current?.click();
              } else {
                alert(`Função ${type} ativada!`);
              }
            }}
            onClose={() => setShowAttachmentMenu(false)}
          />
        )}

        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <EmojiPicker
            onSelectEmoji={handleSelectEmoji}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {/* Quick Responses Popup */}
        <QuickResponsesPopup
          isOpen={showQuickResponsesPopup}
          onClose={() => setShowQuickResponsesPopup(false)}
          quickResponses={cannedResponses.responses}
          onSelectResponse={(selectedMsg) => {
            setInputText(selectedMsg);
            setShowQuickResponsesPopup(false);
          }}
          filterQuery={inputText.startsWith('/') ? inputText.slice(1) : ''}
          onSearchQueryChange={setQuickResponsesQuery}
          status={cannedResponses.status}
          error={cannedResponses.error}
          onRetry={() => void cannedResponses.retry()}
          isDarkMode={isDarkMode}
        />

        {/* Mentions Popup */}
        <MentionsPopup
          isOpen={showMentionsPopup}
          onClose={() => setShowMentionsPopup(false)}
          members={groupMembers}
          filterQuery={mentionFilterQuery}
          onSelectMember={handleSelectMention}
          isDarkMode={isDarkMode}
        />

        {/* Chatwoot Style Input Card Container */}
        <div
          className={`w-full rounded-2xl p-3 border shadow-xl transition-colors duration-200 flex flex-col space-y-2 ${
            messageMode === 'privada'
              ? isDarkMode
                ? 'bg-[#1a1710] border-amber-600/40'
                : 'bg-[#fffbeb] border-amber-300'
              : isDarkMode
              ? 'bg-[#151717] border-[#1e1f1f]'
              : 'bg-white border-[#d1d7db]'
          }`}
        >
          {/* Top Pill Switcher & Header Icons */}
          <div className="flex items-center justify-between shrink-0">
            {/* Pill Switcher [Responder | Mensagem Privada] */}
            <div
              className={`inline-flex items-center p-0.5 rounded-xl transition-colors ${
                isDarkMode ? 'bg-[#1e1f1f]' : 'bg-[#f0f2f5]'
              }`}
            >
              <button
                type="button"
                onClick={() => setMessageMode('responder')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  messageMode === 'responder'
                    ? isDarkMode
                      ? 'bg-[#242525] text-white shadow-xs'
                      : 'bg-white text-[#111b21] shadow-xs'
                    : isDarkMode
                    ? 'text-[#8696a0] hover:text-white'
                    : 'text-[#54656f] hover:text-[#111b21]'
                }`}
              >
                Responder
              </button>

              <button
                type="button"
                onClick={() => setMessageMode('privada')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  messageMode === 'privada'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : isDarkMode
                    ? 'text-[#8696a0] hover:text-amber-400'
                    : 'text-[#54656f] hover:text-amber-700'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Mensagem Privada</span>
              </button>
            </div>

            {/* Top Right Actions (AI & Expand) */}
            <div className="relative flex items-center space-x-1.5 text-[#8696a0]">
              {conversation && <button
                type="button"
                onClick={() => setShowTemplatePicker((current) => !current)}
                title="Enviar template Meta"
                className="rounded-md px-1.5 py-1 text-xs font-semibold hover:bg-white/5 hover:text-[#00a884]"
              >
                Template
              </button>}
              {showTemplatePicker && conversation && <MetaTemplatePicker inboxId={conversation.inboxId} conversationId={conversation.id} onClose={() => setShowTemplatePicker(false)} />}
              <button
                type="button"
                onClick={() => setShowQuickResponsesPopup((prev) => !prev)}
                title="Assistente IA / Respostas Rápidas"
                className="p-1 rounded-md hover:text-purple-400 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpandedInput((prev) => !prev)}
                title={isExpandedInput ? "Reduzir editor" : "Expandir editor"}
                className={`p-1 rounded-md transition-colors cursor-pointer ${
                  isExpandedInput
                    ? 'text-emerald-400 bg-white/10'
                    : 'hover:text-white hover:bg-white/5'
                }`}
              >
                {isExpandedInput ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {recordingError && !isRecordingVoice && <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-amber-300"><span>{recordingError}</span><button type="button" onClick={() => void handleStartRecording()} className="shrink-0 rounded-md bg-[#00a884] px-2.5 py-1.5 text-[11px] font-bold text-[#0b141a] hover:bg-[#25d366]">Permitir microfone</button></div>}

          {replyTo && !isRecordingVoice && (
            <div className={`flex items-center justify-between gap-3 rounded-lg border-l-4 border-[#00a884] px-3 py-2 ${isDarkMode ? 'bg-black/20 text-[#aebac1]' : 'bg-[#f0f2f5] text-[#54656f]'}`}>
              <div className="min-w-0"><p className="text-[11px] font-bold text-[#00a884]">Respondendo a {replyTo.senderName}</p><p className="truncate text-xs">{replyTo.text}</p></div>
              <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 text-xs font-bold text-[#8696a0] hover:text-red-400">Cancelar</button>
            </div>
          )}

          {!isRecordingVoice && selectedFiles.length > 0 && (
            <div className="space-y-1.5 border-y border-black/5 dark:border-white/5 py-2">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 bg-black/5 dark:bg-white/5 text-xs">
                  <span className="min-w-0 truncate flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 shrink-0 text-[#00a884]" />{file.name} <span className="text-[#8696a0]">({Math.ceil(file.size / 1024)} KB)</span></span>
                  <button type="button" disabled={isSendingMessage} onClick={() => setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="text-[#8696a0] hover:text-red-500 disabled:opacity-40" title={`Remover ${file.name}`}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {isSendingMessage && <p className="text-[11px] text-[#8696a0]">Enviando mensagem e anexos…</p>}
            </div>
          )}

          {/* Recording Voice Note active/paused UI OR Text Input Area */}
          {isRecordingVoice ? (
            <div className="min-h-[60px] px-1 py-2 flex items-center justify-between overflow-hidden">
              {/* Trash button */}
              <button
                onClick={handleCancelRecording}
                title="Cancelar e apagar áudio"
                className="text-[#8696a0] hover:text-[#f15c6d] p-1.5 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              {!isRecordingPaused ? (
                /* Actively Recording State */
                <>
                  {/* Red recording dot + time */}
                  <div className="flex items-center space-x-2 px-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f15c6d] animate-pulse" />
                    <span className={`text-sm font-semibold font-mono ${isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                      {formatRecordingTime(recordingTime)}
                    </span>
                  </div>

                  {/* Dotted audio wave line */}
                  <div className="flex-1 min-w-0 mx-2 overflow-hidden flex items-center">
                    <div className="w-full tracking-[3px] text-[#8696a0]/60 text-xs font-mono select-none truncate">
                      ...............................................................................
                    </div>
                  </div>

                  {/* Pause icon button */}
                  <button
                    onClick={() => {
                      mediaRecorderRef.current?.pause();
                      setIsRecordingPaused(true);
                      setIsPreviewPlaying(false);
                      setPreviewProgress(0);
                    }}
                    title="Pausar gravação"
                    className="text-[#f15c6d] hover:opacity-80 p-1.5 shrink-0 cursor-pointer"
                  >
                    <Pause className="w-5 h-5 fill-current" />
                  </button>
                </>
              ) : (
                /* Paused / Audio Preview State */
                <>
                  <button
                    onClick={() => {
                      if (isPreviewPlaying) {
                        setIsPreviewPlaying(false);
                      } else {
                        if (previewProgress >= 99) setPreviewProgress(0);
                        setIsPreviewPlaying(true);
                      }
                    }}
                    title={isPreviewPlaying ? 'Pausar reprodução' : 'Ouvir áudio gravado'}
                    className={`p-1.5 shrink-0 cursor-pointer transition-colors ${
                      isDarkMode ? 'text-white hover:text-gray-300' : 'text-[#111b21] hover:text-gray-700'
                    }`}
                  >
                    {isPreviewPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                      setPreviewProgress(pct);
                    }}
                    className="flex-1 min-w-0 mx-2 relative h-6 flex items-center cursor-pointer group"
                  >
                    <div className="w-full h-0 border-b-2 border-dotted border-[#8696a0]/60 relative">
                      <div
                        style={{ left: `${previewProgress}%` }}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-xs transition-all group-hover:scale-125"
                      />
                    </div>
                  </div>

                  <span className={`text-sm font-semibold font-mono shrink-0 mr-1 ${isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                    {formatRecordingTime(recordingTime)}
                  </span>

                  <button
                    onClick={() => {
                      mediaRecorderRef.current?.resume();
                      setIsRecordingPaused(false);
                      setIsPreviewPlaying(false);
                    }}
                    title="Continuar gravação"
                    className="p-1.5 rounded-full text-[#f15c6d] hover:bg-[#f15c6d]/10 transition-colors shrink-0 cursor-pointer"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </>
              )}

              <button
                onClick={handleSend}
                title="Enviar áudio"
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-black flex items-center justify-center shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer ml-1"
              >
                <SendHorizontal className="w-4 h-4 text-[#111b21] stroke-[2.2]" />
              </button>
            </div>
          ) : (
            /* Middle Textarea Input */
            <div className="w-full py-1 relative">
              {/* Formatted live backdrop layer */}
              <div
                ref={backdropRef}
                aria-hidden="true"
                className={`absolute inset-x-0 top-1 bottom-1 pointer-events-none whitespace-pre-wrap break-words font-sans text-[14px] leading-relaxed select-none overflow-hidden ${
                  isExpandedInput ? 'min-h-[180px] max-h-[300px]' : 'min-h-[52px] max-h-[140px]'
                } ${
                  messageMode === 'privada'
                    ? isDarkMode
                      ? 'text-[#fef08a]'
                      : 'text-[#78350f]'
                    : isDarkMode
                    ? 'text-[#e9edef]'
                    : 'text-[#111b21]'
                }`}
              >
                {renderFormattedText(inputText, 0, true)}
              </div>

              <textarea
                ref={textareaRef}
                rows={isExpandedInput ? 7 : 2}
                value={inputText}
                onScroll={(e) => {
                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputText(val);

                  if (backdropRef.current) {
                    backdropRef.current.scrollTop = e.currentTarget.scrollTop;
                  }

                  // Quick responses
                  if (val.startsWith('/')) {
                    setShowQuickResponsesPopup(true);
                  } else if (!val.trim()) {
                    setShowQuickResponsesPopup(false);
                  }

                  // Mentions check (@)
                  const lastAtIndex = val.lastIndexOf('@');
                  if (lastAtIndex !== -1) {
                    const textAfterAt = val.slice(lastAtIndex + 1);
                    if (!textAfterAt.includes('\n')) {
                      setShowMentionsPopup(true);
                      setMentionFilterQuery(textAfterAt);
                    } else {
                      setShowMentionsPopup(false);
                    }
                  } else {
                    setShowMentionsPopup(false);
                  }
                }}
                onKeyDown={(e) => {
                  if ((showQuickResponsesPopup || showMentionsPopup) && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
                    return;
                  }
                  handleKeyDown(e);
                }}
                placeholder={
                  messageMode === 'privada'
                    ? "Shift + enter para nova linha. Esta é uma mensagem privada (visível apenas para membros da equipe). Digite '/' para selecionar uma Resposta Pronta."
                    : "Shift + enter para nova linha. Digite '/' para selecionar uma Resposta Pronta."
                }
                className={`w-full relative z-10 bg-transparent text-[14px] outline-none resize-none transition-all duration-200 ${
                  isExpandedInput ? 'min-h-[180px] max-h-[300px]' : 'min-h-[52px] max-h-[140px]'
                } overflow-y-auto leading-relaxed ${
                  inputText.length > 0 ? 'text-transparent caret-black dark:caret-white' : ''
                } ${
                  messageMode === 'privada'
                    ? isDarkMode
                      ? 'placeholder-amber-400/50'
                      : 'placeholder-amber-700/50'
                    : isDarkMode
                    ? 'text-[#e9edef] placeholder-[#8696a0]'
                    : 'text-[#111b21] placeholder-[#667781]'
                }`}
              />
            </div>
          )}

          {/* Bottom Bar: Action Toolbar Icons (Left) & Send Button (Right) */}
          {!isRecordingVoice && (
            <div className="flex items-center justify-between pt-1 border-t border-white/5 gap-1">
              {/* Left Toolbar Icons */}
              <div className="flex items-center space-x-0.5 sm:space-x-1 overflow-x-auto no-scrollbar shrink min-w-0 pr-1">
                <button
                  type="button"
                  disabled={isSendingMessage}
                  onClick={() => {
                    setShowEmojiPicker((prev) => !prev);
                    setShowAttachmentMenu(false);
                    setShowQuickResponsesPopup(false);
                    setShowMentionsPopup(false);
                  }}
                  title="Emojis"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    showEmojiPicker
                      ? 'text-[#00a884] bg-[#00a884]/10'
                      : isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Smile className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  disabled={isSendingMessage}
                  onClick={() => {
                    setShowAttachmentMenu((prev) => !prev);
                    setShowEmojiPicker(false);
                    setShowQuickResponsesPopup(false);
                    setShowMentionsPopup(false);
                  }}
                  title="Anexar arquivos"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    showAttachmentMenu
                      ? 'text-[#00a884] bg-[#00a884]/10'
                      : isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  disabled={isSendingMessage || selectedFiles.length > 0}
                  onClick={handleStartRecording}
                  title="Gravar áudio"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const lastAtIndex = inputText.lastIndexOf('@');
                    if (lastAtIndex === -1 || lastAtIndex < inputText.length - 1) {
                      setInputText((prev) => (prev.endsWith(' ') || !prev ? `${prev}@` : `${prev} @`));
                      setMentionFilterQuery('');
                    }
                    setShowMentionsPopup(true);
                    setShowEmojiPicker(false);
                    setShowAttachmentMenu(false);
                    setShowQuickResponsesPopup(false);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                  title="Mencionar membro (@)"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    showMentionsPopup
                      ? 'text-[#00a884] bg-[#00a884]/10'
                      : isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <AtSign className="w-5 h-5" />
                </button>

                <div className="h-4 w-[1px] bg-black/10 dark:bg-white/10 mx-0.5 self-center shrink-0 hidden sm:block" />

                <button
                  type="button"
                  onClick={() => applyFormattingSymbol('*')}
                  title="Negrito (*negrito* ou Ctrl+B)"
                  className={`hidden sm:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Bold className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => applyFormattingSymbol('_')}
                  title="Itálico (_itálico_ ou Ctrl+I)"
                  className={`hidden sm:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Italic className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => applyFormattingSymbol('~')}
                  title="Tachado (~tachado~ ou Ctrl+Shift+X)"
                  className={`hidden sm:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Strikethrough className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => applyFormattingSymbol('`')}
                  title="Código (`código` ou Ctrl+Shift+C)"
                  className={`hidden sm:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Code className="w-4 h-4" />
                </button>
              </div>

              {/* Right Send / Note Button */}
              <div className="shrink-0">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSendingMessage || (!inputText.trim() && selectedFiles.length === 0)}
                  title={messageMode === 'privada' ? "Criar nota privada" : "Enviar mensagem"}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-40 ${
                    messageMode === 'privada'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
                  }`}
                >
                  {messageMode === 'privada' ? (
                    <>
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>{isSendingMessage ? 'Enviando…' : <>Criar Nota <span className="hidden sm:inline">(CTRL + ↵)</span></>}</span>
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="w-3.5 h-3.5 shrink-0 sm:hidden" />
                      <span className="hidden sm:inline">{isSendingMessage ? 'Enviando…' : 'Enviar (CTRL + ↵)'}</span>
                      <span className="sm:hidden">{isSendingMessage ? 'Enviando…' : 'Enviar'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Search Messages Side Drawer */}
      {isSearchOpen && (
        <SearchMessagesPanel
          chat={chat}
          isDarkMode={isDarkMode}
          onClose={() => setIsSearchOpen(false)}
          onSelectMessage={(msgId) => {
            const el = document.getElementById(`msg-${msgId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('bg-[#00a884]/20');
              setTimeout(() => el.classList.remove('bg-[#00a884]/20'), 2000);
            }
          }}
        />
      )}

      {/* Contact Attributes Side Panel */}
      {isContactPanelOpen && contactStatus !== 'idle' && onRetryContact && onUpdateContact && onCreateContactNote ? (
        <ContactDetailsPanel
          contact={contact || null}
          notes={contactNotes}
          status={contactStatus}
          error={contactError}
          isSaving={isContactSaving}
          isCreatingNote={isCreatingContactNote}
          initialTab={contactPanelTab}
          isDarkMode={isDarkMode}
          onRetry={onRetryContact}
          onUpdate={onUpdateContact}
          onCreateNote={onCreateContactNote}
          onClose={() => setIsContactPanelOpen(false)}
        />
      ) : isContactPanelOpen && (
        <ContactAttributesPanel
          chat={chat}
          allChats={allChats}
          onSelectChat={onSelectChat}
          isDarkMode={isDarkMode}
          onClose={() => setIsContactPanelOpen(false)}
          activeTab={contactPanelTab}
        />
      )}

      {/* Context Menu for Messages */}
      <ContextMenu
        x={menuState.x}
        y={menuState.y}
        isOpen={menuState.isOpen}
        onClose={closeContextMenu}
        items={menuState.items}
        title={menuState.title}
        isDarkMode={isDarkMode}
      />

      {messagePendingDeletion && <div className="fixed inset-0 z-[10001] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-message-title">
        <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228] text-[#e9edef]' : 'border-[#d1d7db] bg-white text-[#111b21]'}`}>
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-400"><Trash2 className="h-5 w-5" /></div><div><h3 id="delete-message-title" className="text-sm font-bold">Excluir mensagem?</h3><p className="mt-1 text-xs leading-5 text-[#8696a0]">Esta ação removerá a mensagem desta conversa.</p></div></div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setMessagePendingDeletion(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-[#aebac1] hover:bg-white/5">Cancelar</button><button type="button" onClick={() => { const message = messagePendingDeletion; setMessagePendingDeletion(null); if (onDeleteMessage) void onDeleteMessage(message.id); else { const idx = chat.messages.findIndex(item => item.id === message.id); if (idx >= 0) { chat.messages.splice(idx, 1); forceUpdate(value => value + 1); } } }} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Excluir</button></div>
        </div>
      </div>}
      {messagePendingRevoke && <div className="fixed inset-0 z-[10001] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="revoke-message-title">
        <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228] text-[#e9edef]' : 'border-[#d1d7db] bg-white text-[#111b21]'}`}>
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-400"><Trash2 className="h-5 w-5" /></div><div><h3 id="revoke-message-title" className="text-sm font-bold">Apagar para todos?</h3><p className="mt-1 text-xs leading-5 text-[#8696a0]">A mensagem será apagada no WhatsApp para todos os participantes.</p></div></div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setMessagePendingRevoke(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-[#aebac1] hover:bg-white/5">Cancelar</button><button type="button" onClick={() => { const message = messagePendingRevoke; setMessagePendingRevoke(null); if (onRevokeMessage) void onRevokeMessage(message.id); }} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Apagar para todos</button></div>
        </div>
      </div>}
    </div>
  );
};
