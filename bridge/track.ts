import { randomUUID } from 'node:crypto';

export type TrackId = `trk_${string}`;

export const createTrackId = (): TrackId => `trk_${randomUUID().replace(/-/g, '')}`;

export interface UnifiedWhatsAppEvent {
  trackId: TrackId;
  transport: 'evolution' | 'waha' | 'meta_cloud';
  event: string;
  category: string;
  type: string;
  timestamp: string;
  externalId?: string;
  chatId?: string;
  participantId?: string;
  session?: string;
  fromMe?: boolean;
  fromHistory?: boolean;
}
