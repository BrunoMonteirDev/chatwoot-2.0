export type AudioRecordingPhase = 'idle' | 'recording' | 'paused' | 'review';

export const recordingMimeType = (isSupported: (type: string) => boolean): string | undefined =>
  ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4']
    .find(isSupported);

export const extensionForRecordingMimeType = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('mp4') || normalized.includes('aac')) return 'm4a';
  return 'webm';
};

export const finiteAudioDuration = (duration: number) => Number.isFinite(duration) && duration > 0 ? duration : null;

export const recordingFile = (chunks: Blob[], mimeType: string, timestamp = Date.now()) => {
  const extension = extensionForRecordingMimeType(mimeType);
  return new File([new Blob(chunks, { type: mimeType })], `audio-${timestamp}.${extension}`, { type: mimeType });
};

export const releaseRecordingResources = (stream: MediaStream | null, objectUrl: string | null, revokeObjectUrl = URL.revokeObjectURL) => {
  stream?.getTracks().forEach((track) => track.stop());
  if (objectUrl) revokeObjectUrl(objectUrl);
};
