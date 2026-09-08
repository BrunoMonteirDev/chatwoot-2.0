import type { Inbox } from '../../domain/currentUser';

export type SettingsInboxRouteState = 'list' | 'pending' | 'selected' | 'missing';

export const settingsInboxRouteState = (
  selectedInboxId: number | null,
  inboxes: Inbox[],
  inboxesStatus: 'idle' | 'loading' | 'ready' | 'error'
): SettingsInboxRouteState => {
  if (!selectedInboxId) return 'list';
  if (inboxes.some((inbox) => inbox.id === selectedInboxId)) return 'selected';
  return inboxesStatus === 'idle' || inboxesStatus === 'loading' ? 'pending' : 'missing';
};
