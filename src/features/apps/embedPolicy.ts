export type EmbedStatus = 'loading' | 'ready' | 'blocked';

export const DASHBOARD_APP_SANDBOX =
  'allow-forms allow-same-origin allow-scripts';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export const isAllowedDashboardAppUrl = (
  value: string,
  allowLocalHttp = false
) => {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;

    return (
      allowLocalHttp &&
      url.protocol === 'http:' &&
      LOCALHOST_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
};

export const nextEmbedStatus = (
  event: 'load' | 'error'
): EmbedStatus => (event === 'error' ? 'blocked' : 'ready');
