export const BOTTOM_THRESHOLD_PX = 80;

export const isAtConversationBottom = (scrollHeight: number, scrollTop: number, clientHeight: number) => (
  scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD_PX
);

export const preservedScrollTopAfterPrepend = (scrollTop: number, previousScrollHeight: number, nextScrollHeight: number) => (
  scrollTop + Math.max(0, nextScrollHeight - previousScrollHeight)
);

// Metadata is display-only. Keeping this mapping pure makes it impossible for
// a duration update to issue a scroll command.
export const audioDurationLabel = (duration: number | null, fallback: string) => (
  duration && duration > 0
    ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
    : fallback
);
