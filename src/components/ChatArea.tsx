import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Copy,
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
  FileArchive,
  FileSpreadsheet,
  Download,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  AtSign,
  Lock,
  Unlock,
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
  X,
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
import { getMessageContextMenuItems } from '../utils/contextMenuActions';
import { capabilitiesForMessage } from '../features/messages/capabilities';
import { ConversationManagementMenu } from './ConversationManagementMenu';
import { ContactDetailsPanel } from './ContactDetailsPanel';
import { conversationManagementService, type ConversationManagementCatalogs } from '../integrations/chatwoot/conversationManagement';
import type { AssignableAgent, CannedResponse, ConversationPriority, ConversationStatus, ConversationSummary, Inbox } from '../domain/currentUser';
import type { RealtimeConnectionStatus } from '../integrations/chatwoot/realtime';
import type { ContactNote, ContactProfile } from '../domain/currentUser';
import type { ContactUpdate } from '../integrations/chatwoot/contacts';
import { useCannedResponses } from '../features/cannedResponses/useCannedResponses';
import { quickNotesStorage, QUICK_NOTES_UPDATED_EVENT } from '../features/quickNotes/storage';
import { MetaTemplatePicker } from './MetaTemplatePicker';
import { ForwardMessageModal } from './ForwardMessageModal';
import { metaCloudMetadataForInbox } from '../integrations/whatsapp/provider';
import { canSendWhatsAppMessage, type OperationalWhatsAppConnection } from '../integrations/whatsapp/connection';
import { finiteAudioDuration, recordingFile, recordingMimeType, releaseRecordingResources, type AudioRecordingPhase } from '../features/audio/recording';
import { documentPresentation, filesFromTransfer, hasFilesInTransfer, triggerAttachmentDownload } from '../features/attachments/fileUtils';
import { shouldSendMessageOnEnter, type SendMessageShortcut } from '../features/messages/sendMessageShortcut';
import { useContactConversations } from '../features/contacts/useContactConversations';
import { useConversationAttachments } from '../features/attachments/useConversationAttachments';


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
    <div className="select-text cursor-text text-[14.5px] leading-relaxed whitespace-pre-wrap break-words pr-2">
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
  onOpenOriginal: (messageId: string) => void;
}> = ({ replyTo, onOpenOriginal }) => {
  const openOriginal = () => {
    if (replyTo.id) onOpenOriginal(replyTo.id);
  };
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        openOriginal();
      }}
      className="mb-2 flex min-w-0 w-full overflow-hidden rounded-r-lg rounded-tl-sm border-l-4 border-[#00a884] bg-black/20 dark:bg-black/30 border-r border-t border-b border-white/5 text-left cursor-pointer hover:bg-black/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
      aria-label={`Ir para a mensagem de ${replyTo.senderName}`}
    >
      <div className="min-w-0 flex-1 p-2.5">
        <div className="text-xs font-semibold text-[#00a884] truncate">
          {replyTo.senderName}
        </div>
        <div className="text-xs text-[#8696a0] truncate mt-0.5">
          {replyTo.text}
        </div>
      </div>
      {replyTo.mediaPreviewUrl && <img src={replyTo.mediaPreviewUrl} alt="Prévia da mídia respondida" className="h-14 w-14 shrink-0 object-cover" />}
    </button>
  );
};

const MessageReactions: React.FC<{
  reactions: MessageReaction[];
  isDarkMode: boolean;
  onSelect?: (emoji: string) => void;
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
      {grouped.map((reaction) => {
        const className = `rounded-full border px-1.5 py-0.5 text-xs shadow-sm transition-colors ${reaction.own
          ? 'border-[#00a884] bg-[#00a884]/15'
          : isDarkMode ? 'border-[#37464f] bg-[#202c33]' : 'border-[#d1d7db] bg-white'}`;
        const content = <><span>{reaction.emoji}</span>{reaction.count > 1 && <span className="ml-1 text-[10px] text-[#667781] dark:text-[#aebac1]">{reaction.count}</span>}</>;
        return onSelect ? (
          <button key={reaction.emoji} type="button" onClick={(event) => { event.stopPropagation(); onSelect(reaction.emoji); }} title={reaction.own ? 'Remover sua reação' : 'Reagir com este emoji'} className={`${className} hover:bg-[#2a3942]`}>
            {content}
          </button>
        ) : <span key={reaction.emoji} className={className}>{content}</span>;
      })}
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
  const presentation = documentPresentation(attachment.title, attachment.subtitle);
  const Icon = presentation.kind === 'spreadsheet' ? FileSpreadsheet : presentation.kind === 'archive' ? FileArchive : FileText;
  const iconColor = presentation.kind === 'pdf' ? 'bg-[#ef4444]' : presentation.kind === 'spreadsheet' ? 'bg-[#16a34a]' : presentation.kind === 'archive' ? 'bg-[#f59e0b]' : 'bg-[#64748b]';
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
        <div className={`w-10 h-11 ${iconColor} text-white rounded-lg flex flex-col items-center justify-center font-black shadow-xs shrink-0`}>
          <Icon className="w-5 h-5 mb-0.5" />
          <span className="text-[9px] uppercase tracking-tighter leading-none">{presentation.kind === 'archive' ? 'ZIP' : presentation.label}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-[#e9edef] leading-snug">
            {attachment.title || 'documento.pdf'}
          </p>
          <p className="text-xs text-[#8696a0] truncate mt-0.5">
            {presentation.label}{attachment.size ? ` • ${attachment.size}` : ''}
          </p>
        </div>
        <button
          onClick={(event) => { event.stopPropagation(); triggerAttachmentDownload(attachment.url, attachment.title, 'anexo'); }}
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
  audioDuration = '—:—',
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
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Realistic waveform height sequence (in px)
  const waveformHeights = [
    6, 12, 18, 22, 10, 16, 24, 14, 8, 20,
    16, 22, 26, 18, 12, 20, 24, 16, 10, 18,
    22, 14, 8, 16, 20, 12, 6, 14, 18, 10,
    6, 12
  ];

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = Number(playbackSpeed.replace('x', ''));
  }, [playbackSpeed]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return audioDuration;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        if (audio.ended) audio.currentTime = 0;
        await audio.play();
        setHasPlayed(true);
      } catch {
        setIsPlaying(false);
      }
    } else audio.pause();
  };

  const seek = (percentage: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = audio.duration * percentage / 100;
    setProgress(percentage);
    setCurrentSeconds(audio.currentTime);
  };

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
            void togglePlayback();
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
              void togglePlayback();
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
            seek(newPct);
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
              void togglePlayback();
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
      {audioUrl && (
        <audio
          ref={audioRef}
          preload="metadata"
          src={audioUrl}
          onLoadedMetadata={(event) => setDurationSeconds(finiteAudioDuration(event.currentTarget.duration) || 0)}
          onDurationChange={(event) => setDurationSeconds(finiteAudioDuration(event.currentTarget.duration) || 0)}
          onTimeUpdate={(event) => {
            const audio = event.currentTarget;
            setCurrentSeconds(audio.currentTime);
            const duration = finiteAudioDuration(audio.duration);
            setProgress(duration ? (audio.currentTime / duration) * 100 : 0);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); setProgress(100); }}
          onError={() => setIsPlaying(false)}
          className="hidden"
        >
          Seu navegador não suporta áudio.
        </audio>
      )}

      {/* Footer: duration on bottom-left, time on bottom-right */}
      <div className="flex justify-between items-center text-[11px] text-[#8696a0] font-sans mt-0.5 px-0.5">
        <span>{durationSeconds ? `${formatDuration(currentSeconds)} / ${formatDuration(durationSeconds)}` : audioDuration}</span>
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
  hasOnlyHiddenSystemMessages?: boolean;
  isLoadingOlder?: boolean;
  onRetryHistory?: () => void;
  onLoadOlderMessages?: () => void;
  onRetryMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
  onEditMessage?: (messageId: string, content: string) => Promise<boolean>;
  onRevokeMessage?: (messageId: string) => Promise<boolean>;
  onReactMessage?: (messageId: string, emoji: string) => Promise<boolean> | boolean;
  onForwardMessage?: (messageId: string, destinationConversationId: string) => Promise<{ ok: boolean; error?: string }>;
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
  historyScrollTop?: number;
  onHistoryScrollChange?: (scrollTop: number) => void;
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
  inboxes?: Inbox[];
  whatsappConnection?: OperationalWhatsAppConnection | null;
  sendMessageShortcut?: SendMessageShortcut;
  onCopyConversationLink?: () => void;
  onOpenDirectConversation?: (conversationId: number) => void;
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
  hasOnlyHiddenSystemMessages = false,
  isLoadingOlder = false,
  onRetryHistory,
  onLoadOlderMessages,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onRevokeMessage,
  onReactMessage,
  onForwardMessage,
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
  historyScrollTop = 0,
  onHistoryScrollChange,
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
  inboxes = [],
  whatsappConnection = null,
  sendMessageShortcut = 'enter',
  onCopyConversationLink,
  onOpenDirectConversation,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  const [contactPanelTab, setContactPanelTab] = useState<'contact' | 'attributes' | 'content'>('contact');
  const [conversationParticipants, setConversationParticipants] = useState<AssignableAgent[]>([]);
  const [inputText, setInputText] = useState('');
  const [messageMode, setMessageMode] = useState<'responder' | 'privada'>('responder');
  const contactConversations = useContactConversations(accountId, conversation?.contactId ?? null, isContactPanelOpen);
  const conversationAttachments = useConversationAttachments(accountId, conversation?.id ?? null, isContactPanelOpen);
  const [ticketStatus, setTicketStatus] = useState<'resolver' | 'resolvido' | 'adiado' | 'pendente'>('resolver');
  const [showResolverMenu, setShowResolverMenu] = useState(false);

  useEffect(() => {
    if (!isContactPanelOpen || contactPanelTab !== 'attributes' || !accountId || !conversation) {
      setConversationParticipants([]);
      return;
    }
    let active = true;
    void conversationManagementService.listParticipants(accountId, conversation.id)
      .then((participants) => { if (active) setConversationParticipants(participants); })
      .catch(() => { if (active) setConversationParticipants([]); });
    return () => { active = false; };
  }, [accountId, contactPanelTab, conversation?.id, isContactPanelOpen]);

  const updateConversationParticipants = async (userIds: number[]) => {
    if (!accountId || !conversation) throw new Error('Conversa indisponível.');
    const participants = await conversationManagementService.setParticipants(accountId, conversation.id, userIds);
    setConversationParticipants(participants);
    return participants;
  };
  const [isExpandedInput, setIsExpandedInput] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [recordingPhase, setRecordingPhase] = useState<AudioRecordingPhase>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<{ file: File; url: string; duration: number | null } | null>(null);
  const [isReviewPlaying, setIsReviewPlaying] = useState(false);
  const [reviewCurrentTime, setReviewCurrentTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingLevels, setRecordingLevels] = useState<number[]>(() => Array(28).fill(0));
  const sendingDraftsRef = useRef(new Set<string>());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingCancelledRef = useRef(false);
  const recordingSessionRef = useRef(0);
  const recordingUrlRef = useRef<string | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingAnimationFrameRef = useRef<number | null>(null);
  const reviewAudioRef = useRef<HTMLAudioElement>(null);
  const dragDepthRef = useRef(0);
  const isRecordingVoice = recordingPhase !== 'idle';
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
  const [localQuickResponses, setLocalQuickResponses] = useState<CannedResponse[]>([]);
  useEffect(() => {
    const load = () => {
      const notes = quickNotesStorage.list();
      void Promise.all(notes.map(async (note, index) => ({
        id: -(index + 1),
        shortCode: note.shortcut.trim() || `nota-${index + 1}`,
        content: note.text.trim(),
        attachmentName: note.attachmentName || null,
        attachment: await quickNotesStorage.getAttachment(note),
      }))).then(setLocalQuickResponses).catch(() => setLocalQuickResponses([]));
    };
    load();
    window.addEventListener('storage', load);
    window.addEventListener(QUICK_NOTES_UPDATED_EVENT, load);
    return () => { window.removeEventListener('storage', load); window.removeEventListener(QUICK_NOTES_UPDATED_EVENT, load); };
  }, []);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const conversationInbox = conversation ? inboxes.find((inbox) => inbox.id === conversation.inboxId) : undefined;
  const externalSendBlocked = !canSendWhatsAppMessage(whatsappConnection, messageMode === 'privada');
  const canUseMetaTemplates = !externalSendBlocked && Boolean(conversationInbox && metaCloudMetadataForInbox(conversationInbox));

  // Context Menu State
  const { menuState, openContextMenu, closeContextMenu } = useContextMenu();
  const [messagePendingDeletion, setMessagePendingDeletion] = useState<Message | null>(null);
  const [messagePendingRevoke, setMessagePendingRevoke] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editFailure, setEditFailure] = useState<string | null>(null);
  const [reactionFailureId, setReactionFailureId] = useState<string | null>(null);
  const [messageToForward, setMessageToForward] = useState<Message | null>(null);
  const [isForwardingMessage, setIsForwardingMessage] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);

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
      onEditMessage: (m) => { setEditingMessage(m); setEditingText(m.text || ''); setEditFailure(null); },
      onRevokeMessage: (m) => setMessagePendingRevoke(m),
      onReact: (m, emoji) => void handleReaction(m, emoji),
      onForward: (m) => { setMessageToForward(m); setForwardError(null); },
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

  const forwardMessage = async (destinationConversationId: string) => {
    if (!messageToForward || !onForwardMessage) return;
    setIsForwardingMessage(true);
    setForwardError(null);
    const result = await onForwardMessage(messageToForward.id, destinationConversationId);
    setIsForwardingMessage(false);
    if (result.ok) setMessageToForward(null);
    else setForwardError(result.error || 'Não foi possível encaminhar a mensagem.');
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

  useEffect(() => {
    if (!chat.isGroup) setShowMentionsPopup(false);
  }, [chat.id, chat.isGroup]);


  // Scroll and unread badge state
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [unreadBelowCount, setUnreadBelowCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const closeEditModal = () => {
    if (isSavingEdit) return;
    setEditingMessage(null);
    setEditingText('');
    setEditFailure(null);
  };

  const submitMessageEdit = async () => {
    const target = editingMessage;
    const content = editingText.trim();
    if (!target || !content || !onEditMessage || isSavingEdit) return;
    if (content === (target.text || '').trim()) {
      closeEditModal();
      return;
    }
    setIsSavingEdit(true);
    setEditFailure(null);
    try {
      const updated = await onEditMessage(target.id, content);
      if (updated) {
        setEditingMessage(null);
        setEditingText('');
      } else {
        setEditFailure('Não foi possível editar a mensagem. Tente novamente.');
      }
    } catch {
      setEditFailure('Não foi possível editar a mensagem. Tente novamente.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    if (!editingMessage) return;
    const focusTimer = window.setTimeout(() => {
      editTextareaRef.current?.focus();
      editTextareaRef.current?.setSelectionRange(editingText.length, editingText.length);
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEditModal();
      }
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        void submitMessageEdit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editingMessage, editingText, isSavingEdit]);

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
    }
  }, [inputText, isExpandedInput]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const prevMessagesLength = useRef(chat.messages.length);
  const previousChatId = useRef(chat.id);
  const previousScrollHeight = useRef<number | null>(null);

  const focusMessage = (messageId: string) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('bg-[#00a884]/20');
    window.setTimeout(() => element.classList.remove('bg-[#00a884]/20'), 2000);
  };

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
    onHistoryScrollChange?.(el.scrollTop);
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

    // Realtime, polling, reaction/edit updates and a page prepended above can
    // all replace `chat.messages`. They must never pull the reader to the
    // bottom merely because the latest existing message was sent by us.
    const isPrependingOlderMessages = previousScrollHeight.current !== null;
    if (isNewMessage && !isPrependingOlderMessages && lastMessage.sender === 'me') {
      scrollToBottom();
    } else if (isNewMessage && !isPrependingOlderMessages) {
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

  // Restore the per-conversation position. New conversations without a saved
  // position retain the familiar bottom-of-chat behavior.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const restore = () => { el.scrollTop = historyScrollTop || el.scrollHeight; };
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
  }, [chat.id, historyScrollTop]);

  // Voice recording timer
  useEffect(() => {
    if (recordingPhase === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recordingPhase]);

  const discardRecordedAudio = () => {
    reviewAudioRef.current?.pause();
    releaseRecordingResources(null, recordingUrlRef.current);
    recordingUrlRef.current = null;
    setRecordedAudio(null);
    setIsReviewPlaying(false);
    setReviewCurrentTime(0);
  };

  const stopRecordingMeter = () => {
    if (recordingAnimationFrameRef.current !== null) cancelAnimationFrame(recordingAnimationFrameRef.current);
    recordingAnimationFrameRef.current = null;
    void recordingAudioContextRef.current?.close();
    recordingAudioContextRef.current = null;
    setRecordingLevels(Array(28).fill(0));
  };

  const startRecordingMeter = (stream: MediaStream) => {
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = new AudioContextConstructor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      analyser.getByteTimeDomainData(samples);
      const levels = Array.from({ length: 28 }, (_, index) => {
        const start = Math.floor(index * samples.length / 28);
        const end = Math.floor((index + 1) * samples.length / 28);
        let total = 0;
        for (let sample = start; sample < end; sample += 1) total += Math.abs(samples[sample] - 128);
        return Math.min(1, (total / Math.max(1, end - start)) / 32);
      });
      setRecordingLevels(levels);
      recordingAnimationFrameRef.current = requestAnimationFrame(render);
    };
    recordingAudioContextRef.current = context;
    void context.resume().then(render).catch(stopRecordingMeter);
  };

  useEffect(() => {
    setRecordingPhase('idle');
    setRecordingTime(0);
    setRecordedAudio(null);
    setIsReviewPlaying(false);
    setReviewCurrentTime(0);
    return () => {
      recordingCancelledRef.current = true;
      recordingSessionRef.current += 1;
      mediaRecorderRef.current?.stop();
      stopRecordingMeter();
      releaseRecordingResources(recordingStreamRef.current, recordingUrlRef.current);
      recordingStreamRef.current = null;
      recordingUrlRef.current = null;
      reviewAudioRef.current?.pause();
    };
  }, [chat.id]);

  const handleCancelRecording = () => {
    recordingCancelledRef.current = true;
    recordingSessionRef.current += 1;
    mediaRecorderRef.current?.stop();
    stopRecordingMeter();
    releaseRecordingResources(recordingStreamRef.current, recordingUrlRef.current);
    recordingStreamRef.current = null;
    recordingUrlRef.current = null;
    setRecordingPhase('idle');
    setRecordedAudio(null);
    setIsReviewPlaying(false);
    setReviewCurrentTime(0);
    setRecordingTime(0);
  };

  const handleRerecord = () => {
    discardRecordedAudio();
    setRecordingPhase('idle');
    setRecordingTime(0);
    void handleStartRecording();
  };

  const sendRecordedAudio = (file: File) => {
    setIsSendingMessage(true);
    void Promise.resolve(onSendMessage(chat.id, '', [file], messageMode === 'privada', replyTo)).then((sent) => {
      if (sent === false) addToast('Não foi possível enviar o áudio.', 'error');
    }).catch(() => addToast('Não foi possível enviar o áudio.', 'error')).finally(() => setIsSendingMessage(false));
  };

  const handleStartRecording = async () => {
    if (externalSendBlocked) return;
    setRecordingError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Este navegador não oferece gravação. Envie um arquivo de áudio pelo clipe.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = recordingMimeType((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const session = ++recordingSessionRef.current;
      recordingCancelledRef.current = false;
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      startRecordingMeter(stream);
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stopRecordingMeter();
        releaseRecordingResources(stream, null);
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (recordingCancelledRef.current || session !== recordingSessionRef.current || recordingChunksRef.current.length === 0) return;
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const file = recordingFile(recordingChunksRef.current, type);
        const url = URL.createObjectURL(file);
        recordingUrlRef.current = url;
        setRecordedAudio({ file, url, duration: null });
        setReviewCurrentTime(0);
        setIsReviewPlaying(false);
        setRecordingPhase('review');
      };
      recorder.start();
      setRecordingPhase('recording');
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
    if (externalSendBlocked) return;
    if (isSendingMessage) return;

    if (recordingPhase === 'recording' || recordingPhase === 'paused') {
      setRecordingPhase('review');
      mediaRecorderRef.current?.stop();
      return;
    }

    if (recordingPhase === 'review') {
      if (!recordedAudio) return;
      const file = recordedAudio.file;
      discardRecordedAudio();
      setRecordingPhase('idle');
      setRecordingTime(0);
      sendRecordedAudio(file);
      return;
    }

    if (!inputText.trim() && selectedFiles.length === 0) return;

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

  const handleFinishRecording = () => {
    if (recordingPhase !== 'recording' && recordingPhase !== 'paused') return;
    setRecordingPhase('review');
    mediaRecorderRef.current?.stop();
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

    if (shouldSendMessageOnEnter(e.nativeEvent, sendMessageShortcut)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const addFiles = (files: Iterable<File>) => {
    if (externalSendBlocked) return;
    const incoming = Array.from(files).filter((file) => file instanceof File);
    if (incoming.length) setSelectedFiles((current) => [...current, ...incoming]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handlePasteFiles = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = filesFromTransfer(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    addFiles(files);
  };

  const handleDragEnter = (event: React.DragEvent) => {
    if (!hasFilesInTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!hasFilesInTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event: React.DragEvent) => {
    if (!hasFilesInTransfer(event.dataTransfer)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (!dragDepthRef.current) setIsDraggingFiles(false);
  };

  const handleDropFiles = (event: React.DragEvent) => {
    if (!hasFilesInTransfer(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    addFiles(filesFromTransfer(event.dataTransfer));
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex-1 flex flex-row h-full relative overflow-hidden">
      {/* Main Active Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDropFiles}>
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-0 z-[80] grid place-items-center border-2 border-dashed border-[#00a884] bg-[#00a884]/15 p-6 text-center backdrop-blur-[1px]">
            <div className="rounded-2xl bg-[#111b21] px-5 py-4 text-sm font-bold text-white shadow-2xl">Solte os arquivos para anexar</div>
          </div>
        )}
        {/* Hidden File Input for uploading custom media */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        multiple
        className="hidden"
      />
      <input type="file" ref={imageInputRef} accept="image/*,video/*" onChange={handleFileUpload} multiple className="hidden" />
      <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />

      {/* Chat Header */}
      <div
        className={`h-12 px-2.5 md:h-14 md:px-4 flex items-center justify-between border-b z-20 flex-shrink-0 select-none transition-colors ${
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
          <div className="h-9 w-9 md:h-10 md:w-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#2563eb]">
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
              {externalSendBlocked ? `WhatsApp ${whatsappConnection?.transport || ''} desconectado — envio bloqueado` : typingName ? `${typingName} está digitando…` : chat.about || (chat.isGroup ? 'Clique para dados do grupo' : realtimeConnectionStatus === 'connected' ? 'online' : 'reconectando…')}
            </span>
            {externalSendBlocked && <span className="mt-1 inline-flex w-fit rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-500">Sessão WhatsApp desconectada</span>}
          </div>
        </div>

        {/* Header Action Icons */}
        <div
          className={`flex items-center space-x-0.5 sm:space-x-2 shrink-0 ${
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
            type="button"
            onClick={onCopyConversationLink}
            title="Copiar link da conversa"
            className={`h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'hover:bg-[#2a3942]' : 'hover:bg-[#e9edef]'}`}
          >
            <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={() => {
              setIsSearchOpen((prev) => !prev);
              if (onSearchInChat) onSearchInChat();
              if (isContactPanelOpen) setIsContactPanelOpen(false);
            }}
            title="Pesquisar na conversa"
            className={`hidden h-9 w-9 md:flex md:h-10 md:w-10 items-center justify-center rounded-full transition-colors ${
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
            className={`hidden h-9 w-9 md:flex md:h-10 md:w-10 items-center justify-center rounded-full transition-colors ${
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
          <span title={realtimeConnectionStatus === 'connected' ? 'Realtime conectado' : 'Realtime desconectado'} className={`hidden h-2 w-2 rounded-full md:block ${realtimeConnectionStatus === 'connected' ? 'bg-[#00a884]' : realtimeConnectionStatus === 'connecting' || realtimeConnectionStatus === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-[#8696a0]'}`} />
        </div>
      </div>



      {/* Floating Right Dock Buttons (Contact & Attributes Panel Toggle) */}
      <div className="absolute right-3 top-20 z-20 hidden md:flex flex-col items-center gap-1.5 p-1 rounded-2xl bg-[#222529]/90 dark:bg-[#182228]/95 backdrop-blur-md border border-white/10 shadow-2xl transition-all">
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
          <div className={`py-8 text-center text-sm ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>{hasOnlyHiddenSystemMessages ? 'Mensagens do sistema estão ocultas.' : 'Esta conversa ainda não possui mensagens.'}</div>
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
                <div className={`flex w-full items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
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
                  {/* Private Note Header Badge */}
                  {msg.isPrivate && (
                    <div className="flex items-center space-x-1.5 text-xs font-semibold pb-1 mb-1 border-b border-amber-500/20 text-amber-500 dark:text-amber-400">
                      <Lock className="hidden h-3.5 w-3.5 shrink-0 md:block" />
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
                  {msg.replyTo && <QuotedReplyBox replyTo={msg.replyTo} onOpenOriginal={focusMessage} />}

                  {/* Link Preview Card */}
                  {msg.linkPreview && <LinkPreviewBox linkPreview={msg.linkPreview} />}

                  {/* Audio Note Card */}
                  {(msg.audioAuthor || msg.attachments?.some((a) => a.type === 'audio')) && (
                    <AudioNoteCard
                      audioAuthor={msg.audioAuthor || (msg.sender === 'them' ? msg.senderName : undefined)}
                      audioPhone={msg.audioPhone || (msg.sender === 'them' ? '+55 44 9937-6314' : undefined)}
                      audioDuration={msg.audioDuration}
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
                  {msg.whatsappPreviousContent && (
                    <details className="mt-2 select-text text-xs text-[#8696a0]">
                      <summary className="cursor-pointer select-none hover:text-[#00a884]">Ver texto original</summary>
                      <p className="mt-1 whitespace-pre-wrap break-words rounded bg-black/10 p-2">{msg.whatsappPreviousContent}</p>
                    </details>
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
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck className={`w-4 h-4 ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`} />
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
                {isMe && !msg.isPrivate && msg.origin !== 'mobile' && msg.senderName && (
                  <span
                    title={`${msg.senderName}${msg.senderEmail ? `\n${msg.senderEmail}` : ''}`}
                    aria-label={`Enviado por ${msg.senderName}${msg.senderEmail ? `, ${msg.senderEmail}` : ''}`}
                    className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border text-[10px] font-bold shadow-sm ${
                      isDarkMode ? 'border-[#3b4a54] bg-[#1f2c34] text-[#d9fdd3]' : 'border-[#d1d7db] bg-white text-[#008069]'
                    }`}
                  >
                    {msg.senderAvatarUrl ? <img src={msg.senderAvatarUrl} alt="" className="h-full w-full object-cover" /> : msg.senderName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}
                  </span>
                )}
                </div>
                {msg.reactions && msg.reactions.length > 0 && (
                  <MessageReactions reactions={msg.reactions} isDarkMode={isDarkMode} onSelect={capabilitiesForMessage(msg).canReact ? (emoji) => void handleReaction(msg, emoji) : undefined} />
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
      {!showAttachmentMenu && (isUserScrolledUp || unreadBelowCount > 0) && (
        <button
          onClick={scrollToBottom}
          title="Ir para a última mensagem"
          className={`absolute bottom-[84px] right-3 z-30 w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-all transform active:scale-95 md:bottom-[68px] md:right-6 ${
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
              if (type === 'image') imageInputRef.current?.click();
              else if (type === 'camera') cameraInputRef.current?.click();
              else if (type === 'document' || type === 'audio') fileInputRef.current?.click();
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
          quickResponses={[...localQuickResponses, ...cannedResponses.responses]}
          onSelectResponse={(response) => {
            setInputText(response.content);
            if (response.attachment) setSelectedFiles((current) => [...current, response.attachment as File]);
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
        {chat.isGroup && <MentionsPopup
          isOpen={showMentionsPopup}
          onClose={() => setShowMentionsPopup(false)}
          members={groupMembers}
          filterQuery={mentionFilterQuery}
          onSelectMember={handleSelectMention}
          isDarkMode={isDarkMode}
        />}

        {/* Chatwoot Style Input Card Container */}
        <div
          className={`w-full rounded-none border-0 bg-transparent p-0 shadow-none transition-colors duration-200 flex flex-col space-y-1.5 md:rounded-[22px] md:border md:p-2.5 md:shadow-lg ${
            messageMode === 'privada'
              ? isDarkMode
                ? 'bg-[#1a1710] border-amber-600/40'
                : 'bg-[#fffbeb] border-amber-300'
              : isDarkMode
              ? 'bg-[#151717] border-[#1e1f1f]'
              : 'bg-white border-[#d1d7db]'
          }`}
        >
          {/* Seletor compacto de tipo de mensagem */}
          <div className="hidden md:flex items-center justify-between shrink-0 px-1 md:px-0">
            {/* Pill Switcher [Responder | Mensagem Privada] */}
            <div
              className={`hidden md:inline-flex items-center p-0.5 rounded-xl transition-colors ${
                isDarkMode ? 'bg-[#1e1f1f]' : 'bg-[#f0f2f5]'
              }`}
            >
              <button
                type="button"
                onClick={() => setMessageMode('responder')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
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

              {recordingPhase === 'recording' ? (
                /* Actively Recording State */
                <>
                  {/* Red recording dot + time */}
                  <div className="flex items-center space-x-2 px-1 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f15c6d] animate-pulse" />
                    <span className={`text-sm font-semibold font-mono ${isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                      {formatRecordingTime(recordingTime)}
                    </span>
                  </div>

                  <div className="mx-2 flex h-8 flex-1 min-w-0 items-center justify-between gap-0.5 overflow-hidden" aria-label="Nível do microfone">
                    {recordingLevels.map((level, index) => <span key={index} className="w-1 rounded-full bg-[#f15c6d] transition-[height] duration-75" style={{ height: `${Math.max(3, Math.round(3 + level * 25))}px` }} />)}
                  </div>

                  {/* Pause icon button */}
                  <button
                    onClick={() => {
                      mediaRecorderRef.current?.pause();
                      stopRecordingMeter();
                      setRecordingPhase('paused');
                    }}
                    title="Pausar gravação"
                    className="text-[#f15c6d] hover:opacity-80 p-1.5 shrink-0 cursor-pointer"
                  >
                    <Pause className="w-5 h-5 fill-current" />
                  </button>
                </>
              ) : recordingPhase === 'paused' ? (
                /* Paused recording: it may continue, but is not yet a playable file. */
                <>
                  <span className="mx-2 flex-1 text-xs text-[#8696a0]">Gravação pausada</span>
                  <span className={`text-sm font-semibold font-mono shrink-0 mr-1 ${isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                    {formatRecordingTime(recordingTime)}
                  </span>

                  <button
                    onClick={() => {
                      mediaRecorderRef.current?.resume();
                      if (recordingStreamRef.current) startRecordingMeter(recordingStreamRef.current);
                      setRecordingPhase('recording');
                    }}
                    title="Continuar gravação"
                    className="p-1.5 rounded-full text-[#f15c6d] hover:bg-[#f15c6d]/10 transition-colors shrink-0 cursor-pointer"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  {recordedAudio ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const audio = reviewAudioRef.current;
                          if (!audio) return;
                          if (audio.paused) {
                            if (audio.ended) audio.currentTime = 0;
                            void audio.play().catch(() => setIsReviewPlaying(false));
                          } else audio.pause();
                        }}
                        title={isReviewPlaying ? 'Pausar prévia' : 'Ouvir prévia'}
                        className={`p-1.5 shrink-0 ${isDarkMode ? 'text-white' : 'text-[#111b21]'}`}
                      >
                        {isReviewPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                      </button>
                      <div
                        onClick={(event) => {
                          const audio = reviewAudioRef.current;
                          const duration = recordedAudio?.duration;
                          if (!audio || !duration) return;
                          const rect = event.currentTarget.getBoundingClientRect();
                          const next = Math.max(0, Math.min(duration, ((event.clientX - rect.left) / rect.width) * duration));
                          audio.currentTime = next;
                          setReviewCurrentTime(next);
                        }}
                        className="mx-2 flex h-6 flex-1 cursor-pointer items-center"
                        title="Navegar na prévia"
                      >
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[#8696a0]/40">
                          <div className="h-full bg-[#00a884]" style={{ width: `${recordedAudio?.duration ? Math.min(100, reviewCurrentTime / recordedAudio.duration * 100) : 0}%` }} />
                        </div>
                      </div>
                      <span className={`mr-1 shrink-0 text-sm font-semibold font-mono ${isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                        {recordedAudio?.duration ? `${formatRecordingTime(Math.floor(reviewCurrentTime))} / ${formatRecordingTime(Math.floor(recordedAudio.duration))}` : 'Carregando…'}
                      </span>
                      <audio
                        ref={reviewAudioRef}
                        src={recordedAudio.url}
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                          const duration = finiteAudioDuration(event.currentTarget.duration);
                          setRecordedAudio((current) => current ? { ...current, duration } : current);
                        }}
                        onDurationChange={(event) => {
                          const duration = finiteAudioDuration(event.currentTarget.duration);
                          setRecordedAudio((current) => current ? { ...current, duration } : current);
                        }}
                        onTimeUpdate={(event) => setReviewCurrentTime(event.currentTarget.currentTime)}
                        onPlay={() => setIsReviewPlaying(true)}
                        onPause={() => setIsReviewPlaying(false)}
                        onEnded={(event) => {
                          setIsReviewPlaying(false);
                          setReviewCurrentTime(finiteAudioDuration(event.currentTarget.duration) || 0);
                        }}
                        className="hidden"
                      />
                    </>
                  ) : <span className="mx-2 flex-1 text-xs text-[#8696a0]">Preparando prévia…</span>}
                  <button type="button" onClick={handleRerecord} title="Descartar e regravar" className="p-1.5 text-[#f15c6d] hover:bg-[#f15c6d]/10"><Mic className="h-5 w-5" /></button>
                </>
              )}

              <button
                onClick={recordingPhase === 'review' ? handleSend : handleFinishRecording}
                disabled={isSendingMessage || (recordingPhase === 'review' && !recordedAudio)}
                title={recordingPhase === 'review' ? 'Enviar áudio' : 'Finalizar gravação e ouvir prévia'}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 text-black flex items-center justify-center shadow-xs transition-transform active:scale-95 shrink-0 cursor-pointer ml-1 disabled:opacity-40"
              >
                {recordingPhase === 'review' ? <SendHorizontal className="w-4 h-4 text-[#111b21] stroke-[2.2]" /> : <Check className="w-4 h-4 text-[#111b21] stroke-[2.8]" />}
              </button>
            </div>
          ) : (
            /* Middle Textarea Input */
            <div className="flex items-center gap-2 md:block">
            <div className={`w-full min-w-0 flex-1 rounded-[28px] px-4 py-1 relative md:rounded-none md:px-0 ${messageMode === 'privada' ? isDarkMode ? 'bg-[#1a1710] md:bg-transparent' : 'bg-[#fffbeb] md:bg-transparent' : isDarkMode ? 'bg-[#202c33] md:bg-transparent' : 'bg-[#f0f2f5] md:bg-transparent'}`}>
              <textarea
                ref={textareaRef}
                disabled={externalSendBlocked}
                rows={isExpandedInput ? 7 : 1}
                value={inputText}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputText(val);

                  // Quick responses
                  if (val.startsWith('/')) {
                    setShowQuickResponsesPopup(true);
                  } else if (!val.trim()) {
                    setShowQuickResponsesPopup(false);
                  }

                  // Menções são exclusivas de grupos.
                  const lastAtIndex = val.lastIndexOf('@');
                  if (chat.isGroup && lastAtIndex !== -1) {
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
                onPaste={handlePasteFiles}
                onKeyDown={(e) => {
                  if ((showQuickResponsesPopup || showMentionsPopup) && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) {
                    return;
                  }
                  handleKeyDown(e);
                }}
                placeholder={
                  messageMode === 'privada' ? 'Mensagem privada' : 'Mensagem'
                }
                className={`w-full relative z-10 bg-transparent pl-8 pr-20 pt-[11px] text-[14px] outline-none resize-none transition-all duration-200 md:px-0 md:pt-0 ${
                  isExpandedInput ? 'min-h-[180px] max-h-[300px]' : 'min-h-[44px] max-h-[112px]'
                } overflow-y-auto leading-relaxed ${
                  messageMode === 'privada'
                    ? isDarkMode
                      ? 'text-[#fef08a] placeholder-amber-400/50'
                      : 'text-[#78350f] placeholder-amber-700/50'
                    : isDarkMode
                    ? 'text-[#e9edef] placeholder-[#8696a0]'
                    : 'text-[#111b21] placeholder-[#667781]'
                }`}
              />
              <button
                type="button"
                onClick={() => setMessageMode((current) => current === 'responder' ? 'privada' : 'responder')}
                title={messageMode === 'privada' ? 'Trocar para mensagem normal' : 'Trocar para nota privada'}
                className={`absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full p-1.5 md:hidden ${messageMode === 'privada' ? 'text-amber-500' : isDarkMode ? 'text-[#aebac1]' : 'text-[#54656f]'}`}
              >
                {messageMode === 'privada' ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </button>
              <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1 md:hidden">
                <button
                  type="button"
                  disabled={isSendingMessage || externalSendBlocked}
                  onClick={() => {
                    setShowAttachmentMenu((current) => !current);
                    setShowQuickResponsesPopup(false);
                    setShowMentionsPopup(false);
                  }}
                  title="Anexar"
                  className={`rounded-full p-1.5 ${showAttachmentMenu ? 'text-[#00a884] bg-[#00a884]/10' : isDarkMode ? 'text-[#aebac1]' : 'text-[#54656f]'}`}
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                {canUseMetaTemplates && conversation && <div className="relative">
                  <button type="button" disabled={isSendingMessage} onClick={() => setShowTemplatePicker((current) => !current)} title="Enviar template Meta" className={`rounded-full p-1.5 ${showTemplatePicker ? 'text-[#00a884] bg-[#00a884]/10' : isDarkMode ? 'text-[#aebac1]' : 'text-[#54656f]'}`}><FileText className="h-5 w-5" /></button>
                  {showTemplatePicker && <MetaTemplatePicker inboxId={conversation.inboxId} conversationId={conversation.id} onClose={() => setShowTemplatePicker(false)} />}
                </div>}
              </div>
            </div>
            <button
              type="button"
              disabled={isSendingMessage || externalSendBlocked}
              onClick={() => {
                if (!inputText.trim() && selectedFiles.length === 0) void handleStartRecording();
                else handleSend();
              }}
              title={!inputText.trim() && selectedFiles.length === 0 ? 'Gravar áudio' : 'Enviar mensagem'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md active:scale-95 disabled:opacity-40 md:hidden ${messageMode === 'privada' ? 'bg-amber-600' : 'bg-[#2563eb]'}`}
            >
              {!inputText.trim() && selectedFiles.length === 0 ? <Mic className="h-6 w-6" /> : messageMode === 'privada' ? <Lock className="h-5 w-5" /> : <SendHorizontal className="h-5 w-5" />}
            </button>
            </div>
          )}

          {/* Bottom Bar: Action Toolbar Icons (Left) & Send Button (Right) */}
          {!isRecordingVoice && (
            <div className="hidden md:flex items-center justify-between border-t border-white/5 pt-1 gap-1">
              {/* Left Toolbar Icons */}
              <div className="flex items-center space-x-0.5 sm:space-x-1 overflow-x-auto no-scrollbar shrink min-w-0 pr-1">
                <button
                  type="button"
                  disabled={isSendingMessage || externalSendBlocked}
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

                {canUseMetaTemplates && conversation && <div className="relative shrink-0">
                  <button
                    type="button"
                    disabled={isSendingMessage}
                    onClick={() => setShowTemplatePicker((current) => !current)}
                    title="Enviar template Meta"
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      showTemplatePicker
                        ? 'text-[#00a884] bg-[#00a884]/10'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  {showTemplatePicker && <MetaTemplatePicker inboxId={conversation.inboxId} conversationId={conversation.id} onClose={() => setShowTemplatePicker(false)} />}
                </div>}

                <button
                  type="button"
                  disabled={isSendingMessage || selectedFiles.length > 0 || externalSendBlocked}
                  onClick={handleStartRecording}
                  title="Gravar áudio"
                  className={`hidden md:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                </button>

                {chat.isGroup && <button
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
                  className={`hidden md:inline-flex p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                    showMentionsPopup
                      ? 'text-[#00a884] bg-[#00a884]/10'
                      : isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-white/5'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-black/5'
                  }`}
                >
                  <AtSign className="w-5 h-5" />
                </button>}

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
                  onClick={() => {
                    if (!inputText.trim() && selectedFiles.length === 0) void handleStartRecording();
                    else handleSend();
                  }}
                  disabled={isSendingMessage || externalSendBlocked}
                  title={!inputText.trim() && selectedFiles.length === 0 ? 'Gravar áudio' : messageMode === 'privada' ? 'Criar nota privada' : 'Enviar mensagem'}
                  className={`h-11 w-11 rounded-full text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40 md:h-auto md:w-auto md:px-4 md:py-2 md:rounded-xl ${
                    messageMode === 'privada'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-[#2563eb] hover:bg-[#1d4ed8] text-white'
                  }`}
                >
                  {!inputText.trim() && selectedFiles.length === 0 ? <Mic className="h-6 w-6 md:hidden" /> : messageMode === 'privada' ? (
                    <>
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden md:inline">{isSendingMessage ? 'Enviando…' : 'Criar Nota (CTRL + ↵)'}</span>
                      <Lock className="h-4 w-4 md:hidden" />
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="h-5 w-5 shrink-0 md:hidden" />
                      <span className="hidden md:inline">{isSendingMessage ? 'Enviando…' : 'Enviar (CTRL + ↵)'}</span>
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
            focusMessage(msgId);
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
          conversation={conversation}
          conversationLabels={managementCatalogs?.labels}
          conversationAgents={managementCatalogs?.agents}
          conversationTeams={managementCatalogs?.teams}
          conversationParticipants={conversationParticipants}
          managementPendingAction={managementPendingAction}
          onSetConversationPriority={onSetConversationPriority}
          onAssignConversationAgent={onAssignConversationAgent}
          onAssignConversationTeam={onAssignConversationTeam}
          onSetConversationLabels={onSetConversationLabels}
          onSetConversationParticipants={updateConversationParticipants}
          onRetry={onRetryContact}
          onUpdate={onUpdateContact}
          onCreateNote={onCreateContactNote}
          contactConversations={contactConversations.conversations}
          contactConversationsStatus={contactConversations.status}
          contactConversationsError={contactConversations.error}
          inboxes={inboxes}
          onOpenConversation={onOpenDirectConversation}
          attachments={conversationAttachments.attachments}
          attachmentStatus={conversationAttachments.status}
          attachmentError={conversationAttachments.error}
          hasMoreAttachments={conversationAttachments.hasMore}
          onLoadMoreAttachments={conversationAttachments.loadMore}
          onRetryAttachments={conversationAttachments.retry}
          messages={chat.messages}
          onOpenImage={(url, title) => onImageClick(url, title)}
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

      {editingMessage && <div
        className="fixed inset-0 z-[10001] grid place-items-center bg-black/70 p-4 backdrop-blur-[1px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-message-title"
        onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditModal(); }}
      >
        <div className={`w-full max-w-[540px] overflow-hidden rounded-2xl shadow-2xl ${isDarkMode ? 'bg-[#202c33] text-[#e9edef]' : 'bg-white text-[#111b21]'}`}>
          <header className={`flex items-center gap-3 px-5 py-4 ${isDarkMode ? 'bg-[#202c33]' : 'bg-[#f0f2f5]'}`}>
            <button type="button" onClick={closeEditModal} disabled={isSavingEdit} aria-label="Fechar edição" className={`grid h-8 w-8 place-items-center rounded-full transition-colors disabled:opacity-40 ${isDarkMode ? 'text-[#aebac1] hover:bg-white/10 hover:text-white' : 'text-[#54656f] hover:bg-black/10 hover:text-[#111b21]'}`}><X className="h-5 w-5" /></button>
            <h3 id="edit-message-title" className="text-base font-semibold">Editar mensagem</h3>
          </header>

          <div className={`min-h-36 px-5 py-5 ${isDarkMode ? 'bg-[#111b21]' : 'bg-[#e9edef]'}`}>
            <div className="flex justify-end">
              <div className={`max-w-[82%] rounded-lg px-3 py-2 text-sm shadow-sm ${isDarkMode ? 'bg-[#005c4b] text-[#e9edef]' : 'bg-[#d9fdd3] text-[#111b21]'}`}>
                <p className="whitespace-pre-wrap break-words">{editingMessage.text || 'Mensagem sem texto'}</p>
                <span className={`mt-1 block text-right text-[10px] ${isDarkMode ? 'text-[#aebac1]' : 'text-[#667781]'}`}>{editingMessage.time}</span>
              </div>
            </div>
          </div>

          <div className={`px-5 pb-5 pt-4 ${isDarkMode ? 'bg-[#202c33]' : 'bg-white'}`}>
            <div className={`flex items-end gap-3 border-b-2 pb-2 ${editFailure ? 'border-red-500' : isDarkMode ? 'border-[#00a884]' : 'border-[#008069]'}`}>
              <textarea
                ref={editTextareaRef}
                value={editingText}
                onChange={(event) => { setEditingText(event.target.value); setEditFailure(null); }}
                disabled={isSavingEdit}
                rows={1}
                aria-label="Novo conteúdo da mensagem"
                className={`max-h-36 min-h-8 flex-1 resize-none bg-transparent py-1 text-sm outline-none disabled:opacity-60 ${isDarkMode ? 'placeholder:text-[#8696a0]' : 'placeholder:text-[#667781]'}`}
              />
              <button type="button" onClick={() => void submitMessageEdit()} disabled={!editingText.trim() || isSavingEdit} aria-label="Salvar edição" title="Salvar edição" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f0f2f5] text-[#111b21] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45">
                <Check className="h-6 w-6" strokeWidth={3} />
              </button>
            </div>
            {editFailure ? <p className="mt-2 text-xs text-red-400">{editFailure}</p> : <p className={`mt-2 text-[11px] ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>Enter para salvar · Shift + Enter para nova linha · Esc para cancelar</p>}
          </div>
        </div>
      </div>}

      {messagePendingDeletion && <div className="fixed inset-0 z-[10001] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-message-title">
        <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228] text-[#e9edef]' : 'border-[#d1d7db] bg-white text-[#111b21]'}`}>
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-400"><Trash2 className="h-5 w-5" /></div><div><h3 id="delete-message-title" className="text-sm font-bold">Excluir do Chatwoot?</h3><p className="mt-1 text-xs leading-5 text-[#8696a0]">Esta ação remove a mensagem somente desta conversa no Chatwoot.</p></div></div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setMessagePendingDeletion(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-[#aebac1] hover:bg-white/5">Cancelar</button><button type="button" onClick={() => { const message = messagePendingDeletion; setMessagePendingDeletion(null); if (onDeleteMessage) void onDeleteMessage(message.id); }} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Excluir do Chatwoot</button></div>
        </div>
      </div>}
      {messageToForward && <ForwardMessageModal message={messageToForward} accountId={accountId} sourceConversationId={chat.id} chats={allChats} inboxes={inboxes} isDarkMode={isDarkMode} isSubmitting={isForwardingMessage} error={forwardError} onClose={() => { if (!isForwardingMessage) setMessageToForward(null); }} onForward={(destinationConversationId) => void forwardMessage(destinationConversationId)} />}
      {messagePendingRevoke && <div className="fixed inset-0 z-[10001] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="revoke-message-title">
        <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228] text-[#e9edef]' : 'border-[#d1d7db] bg-white text-[#111b21]'}`}>
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-400"><Trash2 className="h-5 w-5" /></div><div><h3 id="revoke-message-title" className="text-sm font-bold">Apagar para todos?</h3><p className="mt-1 text-xs leading-5 text-[#8696a0]">A mensagem será apagada no WhatsApp para todos os participantes.</p></div></div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setMessagePendingRevoke(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-[#aebac1] hover:bg-white/5">Cancelar</button><button type="button" onClick={() => { const message = messagePendingRevoke; setMessagePendingRevoke(null); if (onRevokeMessage) void onRevokeMessage(message.id); }} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white hover:bg-red-600">Apagar para todos</button></div>
        </div>
      </div>}
    </div>
  );
};
