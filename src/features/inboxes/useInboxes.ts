import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Inbox } from '../../domain/currentUser';
import { inboxService } from '../../integrations/chatwoot/inboxes';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';
import { usesLegacyWhatsAppConnection, whatsappConnectionService } from '../../integrations/whatsapp/connection';
import { whatsappConfigurationForInbox } from '../../integrations/whatsapp/provider';

export type InboxesStatus = 'idle' | 'loading' | 'ready' | 'error';

const orderedConnectionAttributes = (current: Inbox, updated: Inbox) => {
  const attributes = { ...updated.additionalAttributes };
  for (const transport of ['waha', 'evolution', 'meta_cloud'] as const) {
    const bindingKey = transport === 'waha' ? 'waha_session_name' : transport === 'evolution' ? 'evolution_instance_name' : 'meta_phone_number_id';
    if (current.additionalAttributes[bindingKey] !== updated.additionalAttributes[bindingKey]) continue;
    const currentAt = Date.parse(String(current.additionalAttributes[`${transport}_connection_updated_at`] || ''));
    const updatedAt = Date.parse(String(updated.additionalAttributes[`${transport}_connection_updated_at`] || ''));
    if (!Number.isFinite(currentAt) || (Number.isFinite(updatedAt) && updatedAt >= currentAt)) continue;
    attributes[`${transport}_connection_status`] = current.additionalAttributes[`${transport}_connection_status`];
    attributes[`${transport}_connection_updated_at`] = current.additionalAttributes[`${transport}_connection_updated_at`];
  }
  return attributes;
};

export const mergeRealtimeInbox = (current: Inbox[], updated: Inbox): Inbox[] => {
  const previous = current.find(inbox => inbox.id === updated.id);
  const next = previous ? { ...updated, additionalAttributes: orderedConnectionAttributes(previous, updated) } : updated;
  return [...current.filter((inbox) => inbox.id !== updated.id), next].sort((left, right) => left.name.localeCompare(right.name));
};

export const useInboxes = (accountId: number | null) => {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [status, setStatus] = useState<InboxesStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) {
      setInboxes([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      setInboxes(await inboxService.list(accountId));
      setStatus('ready');
    } catch (cause) {
      setInboxes([]);
      setError(errorMessageForUser(cause));
      setStatus('error');
    }
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  const connectionScopes = useMemo(() => inboxes.flatMap(inbox => {
    if (!usesLegacyWhatsAppConnection(inbox.channelType)) return [];
    const configuration = whatsappConfigurationForInbox(inbox);
    if (!configuration) return [];
    const chatTypes: Array<'private' | 'group'> = configuration.transports.includes('meta_cloud') && configuration.transports.some(item => item !== 'meta_cloud')
      ? ['private', 'group'] : ['group'];
    return chatTypes.map(chatType => ({ inboxId: inbox.id, chatType }));
  }), [inboxes.map(inbox => `${inbox.id}:${inbox.additionalAttributes.waha_session_name || ''}:${inbox.additionalAttributes.evolution_instance_name || ''}:${JSON.stringify(inbox.additionalAttributes.whatsapp_transports || [])}`).join('|')]);

  const refreshConnections = useCallback(async () => {
    if (!accountId || !connectionScopes.length) return;
    const results = await Promise.all(connectionScopes.map(async scope => ({
      ...scope,
      connection: await whatsappConnectionService.get(accountId, scope.inboxId, scope.chatType).catch(() => null),
    })));
    setInboxes(current => results.reduce((all, result) => {
      const connection = result.connection;
      if (!connection?.applicable || !connection.transport || !connection.status) return all;
      const found = all.find(inbox => inbox.id === result.inboxId);
      if (!found) return all;
      return mergeRealtimeInbox(all, {
        ...found,
        additionalAttributes: {
          ...found.additionalAttributes,
          [`${connection.transport}_connection_status`]: connection.status,
          [`${connection.transport}_connection_updated_at`]: connection.observedAt || found.additionalAttributes[`${connection.transport}_connection_updated_at`],
        },
      });
    }, current));
  }, [accountId, connectionScopes]);

  useEffect(() => {
    if (status !== 'ready' || !connectionScopes.length) return;
    void refreshConnections();
    const interval = window.setInterval(() => void refreshConnections(), 60_000);
    return () => window.clearInterval(interval);
  }, [connectionScopes, refreshConnections, status]);

  const upsertRealtimeInbox = useCallback((updated: Inbox) => {
    setInboxes((current) => mergeRealtimeInbox(current, updated));
    setStatus('ready');
  }, []);

  return { inboxes, status, error, retry: load, upsertRealtimeInbox };
};
