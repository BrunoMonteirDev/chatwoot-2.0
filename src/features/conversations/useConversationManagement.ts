import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationPriority, ConversationStatus, ConversationSummary } from '../../domain/currentUser';
import { conversationManagementService, type ConversationManagementCatalogs } from '../../integrations/chatwoot/conversationManagement';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

const emptyCatalogs: ConversationManagementCatalogs = { agents: [], teams: [], labels: [] };

export const useConversationManagement = (accountId: number | null, inboxId: number | null) => {
  const [catalogs, setCatalogs] = useState<ConversationManagementCatalogs>(emptyCatalogs);
  const [catalogStatus, setCatalogStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const inFlight = useRef(false);

  const loadCatalogs = useCallback(async () => {
    if (!accountId) return;
    setCatalogStatus('loading');
    setCatalogError(null);
    try {
      setCatalogs(await conversationManagementService.listCatalogs(accountId, inboxId));
      setCatalogStatus('ready');
    } catch (cause) {
      setCatalogError(errorMessageForUser(cause));
      setCatalogStatus('error');
    }
  }, [accountId, inboxId]);

  useEffect(() => {
    if (!accountId) { setCatalogs(emptyCatalogs); setCatalogStatus('idle'); return; }
    void loadCatalogs();
  }, [accountId, loadCatalogs]);

  const run = useCallback(async <T,>(action: string, operation: () => Promise<T>): Promise<T | null> => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setPendingAction(action);
    try {
      return await operation();
    } finally {
      inFlight.current = false;
      setPendingAction(null);
    }
  }, []);

  const requireAccount = () => {
    if (!accountId) throw new Error('Nenhuma conta ativa foi selecionada.');
    return accountId;
  };

  return {
    catalogs,
    catalogStatus,
    catalogError,
    pendingAction,
    retryCatalogs: loadCatalogs,
    setStatus: (conversationId: number, status: ConversationStatus) => run('status', () => conversationManagementService.setStatus(requireAccount(), conversationId, status)),
    setPriority: (conversationId: number, priority: ConversationPriority) => run('priority', () => conversationManagementService.setPriority(requireAccount(), conversationId, priority)),
    assignAgent: (conversationId: number, agentId: number | null) => run('agent', () => conversationManagementService.assignAgent(requireAccount(), conversationId, agentId)),
    assignTeam: (conversationId: number, teamId: number | null) => run('team', () => conversationManagementService.assignTeam(requireAccount(), conversationId, teamId)),
    setLabels: (conversationId: number, labels: string[]) => run('labels', () => conversationManagementService.setLabels(requireAccount(), conversationId, labels)),
    markRead: (conversationId: number) => run('read', () => conversationManagementService.markRead(requireAccount(), conversationId)),
    markUnread: (conversationId: number) => run('unread', () => conversationManagementService.markUnread(requireAccount(), conversationId)),
  };
};
