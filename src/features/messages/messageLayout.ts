export const messageTimelineClassName = 'flex-1 overflow-y-auto px-2 py-3 sm:px-3 md:px-5 lg:px-8 relative space-y-3 z-10';

export const messageBubbleWidthClassName = (hasWideMedia: boolean) =>
  hasWideMedia
    ? 'w-full max-w-[calc(100%_-_2.25rem)] sm:max-w-[92%] md:max-w-[52rem]'
    : 'w-fit max-w-[calc(100%_-_2.25rem)] sm:max-w-[88%] lg:max-w-[82%] xl:max-w-[76%]';

export const messageVisualMediaClassName = 'w-full max-h-[72vh] object-contain';
