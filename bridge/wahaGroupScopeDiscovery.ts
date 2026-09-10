import { transportConfigurationForInbox } from './providers.js';
import type { ApiInbox } from './chatwoot.js';
import type { GroupBackfillScope } from './groupMetadataBackfill.js';

export const wahaGroupScopeForInbox = (accountId: number, inbox: ApiInbox): GroupBackfillScope | null => {
  const attributes = inbox.additional_attributes || {};
  const configuration = transportConfigurationForInbox(attributes);
  const sessionName = inbox.channel_type === 'Channel::Whatsapp'
    ? (attributes.hybrid_enabled === true ? attributes.hybrid_waha_session : null)
    : (configuration?.transports.includes('waha') ? configuration.wahaSessionName : null);
  if (typeof sessionName !== 'string' || !sessionName.trim()) return null;
  return { accountId, inboxId: inbox.id, sessionName };
};

type Dependencies = {
  listAccountIds: () => Promise<number[]>;
  listInboxes: (accountId: number) => Promise<ApiInbox[]>;
  log?: Pick<Console, 'warn'>;
};

// Chatwoot is the durable source of truth for bindings. Rebuilding these
// scopes must not require the bridge's Redis/file ownership index to exist.
export const discoverConfiguredWahaGroupScopes = async ({ listAccountIds, listInboxes, log }: Dependencies) => {
  const accountIds = [...new Set((await listAccountIds()).filter(accountId => Number.isInteger(accountId) && accountId > 0))];
  const batches = await Promise.allSettled(accountIds.map(async accountId =>
    (await listInboxes(accountId)).map(inbox => wahaGroupScopeForInbox(accountId, inbox)).filter((scope): scope is GroupBackfillScope => Boolean(scope)),
  ));
  const scopes = batches.flatMap((batch, index) => {
    if (batch.status === 'fulfilled') return batch.value;
    log?.warn('[groups] account scope discovery skipped', { accountId: accountIds[index], error: batch.reason instanceof Error ? batch.reason.message : 'unknown' });
    return [];
  });
  const unique = new Map(scopes.map(scope => [`${scope.accountId}:${scope.inboxId}:${scope.sessionName}`, scope]));
  return [...unique.values()];
};
