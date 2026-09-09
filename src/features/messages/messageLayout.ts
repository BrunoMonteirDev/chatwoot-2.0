export const messageTimelineClassName = 'flex-1 overflow-y-auto px-2 py-3 sm:px-3 md:px-5 lg:px-8 relative space-y-3 z-10';

export const messageBubbleWidthClassName = (hasWideMedia: boolean) =>
  hasWideMedia
    ? 'w-fit max-w-[calc(100%_-_2.25rem)] sm:max-w-[90%] md:max-w-[30rem]'
    : 'w-fit max-w-[calc(100%_-_2.25rem)] sm:max-w-[88%] lg:max-w-[82%] xl:max-w-[76%]';

export const messageVisualMediaClassName = 'block h-auto w-auto max-w-full max-h-[62vh] md:max-w-[460px] md:max-h-[min(580px,65vh)] object-contain';
