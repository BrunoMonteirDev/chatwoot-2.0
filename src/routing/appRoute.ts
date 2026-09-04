import type { NavTab } from '../types';

export type AppRoute = {
  accountId?: string;
  tab: NavTab;
  conversationId?: string;
  inbox?: string;
  settingsTab?: string;
  settingsInboxId?: string;
  appId?: string;
};

const tabForPath: Record<string, NavTab> = {
  '/status': 'status',
  '/calls': 'calls',
  '/contacts': 'communities',
  '/communities': 'communities',
  '/apps': 'media',
  '/notes': 'tools',
};

const normalizedInbox = (value: string | null) => value && (/^\d+$/.test(value) || value === 'todas') ? value : undefined;

export const appRouteFromUrl = (url: Pick<URL, 'pathname' | 'searchParams'>): AppRoute => {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const accountRoute = path.match(/^\/app\/accounts\/(\d+)(?:\/(.*))?$/);
  const accountId = accountRoute?.[1];
  const suffix = accountRoute?.[2] || '';
  const conversation = suffix.match(/^(?:inbox\/(\d+)\/)?conversations\/(\d+)$/);
  if (accountId && conversation) return { accountId, tab: 'chats', conversationId: conversation[2], ...(conversation[1] ? { inbox: conversation[1] } : {}) };
  // Inbox root is a valid, shareable filtered-list route. It intentionally
  // has no selected conversation.
  const inboxRoot = suffix.match(/^inbox\/(\d+)$/);
  if (accountId && inboxRoot) return { accountId, tab: 'chats', inbox: inboxRoot[1] };
  const inboxList = suffix.match(/^inbox\/(\d+)\/conversations$/);
  if (accountId && inboxList) return { accountId, tab: 'chats', inbox: inboxList[1] };
  if (accountId && (suffix === '' || suffix === 'conversations')) return { accountId, tab: 'chats' };
  const settingsInbox = accountId && suffix.match(/^settings\/(?:inboxes|caixas)\/(\d+)$/);
  if (accountId && settingsInbox) return { accountId, tab: 'settings', settingsTab: 'caixas', settingsInboxId: settingsInbox[1] };
  const settings = accountId && suffix.match(/^settings(?:\/([^/]+))?$/);
  if (accountId && settings) return { accountId, tab: 'settings', ...(settings[1] ? { settingsTab: decodeURIComponent(settings[1]) } : {}) };
  const app = accountId && suffix.match(/^apps\/(\d+)$/);
  if (accountId && app) return { accountId, tab: 'media', appId: app[1] };
  const accountTab = accountId && tabForPath[`/${suffix}`];
  if (accountId && accountTab) return { accountId, tab: accountTab };
  // Compatibility with pre-routing local links. Canonical navigation always
  // writes an account-scoped URL once the authenticated account is known.
  const legacyConversation = path.match(/^\/conversations\/(\d+)$/);
  if (legacyConversation) return { tab: 'chats', conversationId: legacyConversation[1], inbox: normalizedInbox(url.searchParams.get('inbox')) };
  if (path === '/' || path === '/conversations') return { tab: 'chats', inbox: normalizedInbox(url.searchParams.get('inbox')) };
  const legacySettings = path.match(/^\/settings(?:\/([^/]+))?$/);
  if (legacySettings) return { tab: 'settings', ...(legacySettings[1] ? { settingsTab: decodeURIComponent(legacySettings[1]) } : {}) };
  return { tab: tabForPath[path] || 'chats' };
};

export const urlForAppRoute = (route: AppRoute) => {
  const base = route.accountId ? `/app/accounts/${encodeURIComponent(route.accountId)}` : '';
  let pathname = `${base}/conversations`;
  if (route.tab === 'chats') {
    const inbox = route.inbox && route.inbox !== 'todas' ? `/inbox/${encodeURIComponent(route.inbox)}` : '';
    pathname = route.inbox && route.inbox !== 'todas' && !route.conversationId
      ? `${base}/inbox/${encodeURIComponent(route.inbox)}`
      : `${base}${inbox}/conversations${route.conversationId ? `/${encodeURIComponent(route.conversationId)}` : ''}`;
  } else if (route.tab === 'settings') pathname = route.settingsInboxId ? `${base}/settings/inboxes/${encodeURIComponent(route.settingsInboxId)}` : `${base}/settings${route.settingsTab ? `/${encodeURIComponent(route.settingsTab)}` : ''}`;
  else if (route.tab === 'status') pathname = `${base}/status`;
  else if (route.tab === 'calls') pathname = `${base}/calls`;
  else if (route.tab === 'communities') pathname = `${base}/contacts`;
  else if (route.tab === 'media') pathname = `${base}/apps${route.appId ? `/${encodeURIComponent(route.appId)}` : ''}`;
  else if (route.tab === 'tools') pathname = `${base}/notes`;
  return pathname || '/';
};

// Shared links intentionally omit inboxes and list filters. A conversation is
// addressed by its account and stable Chatwoot conversation ID alone.
export const canonicalConversationPath = (accountId: number | string, conversationId: number | string) => (
  urlForAppRoute({ accountId: String(accountId), tab: 'chats', conversationId: String(conversationId) })
);

export const absoluteConversationUrl = (origin: string, accountId: number | string, conversationId: number | string) => (
  new URL(canonicalConversationPath(accountId, conversationId), origin).toString()
);
