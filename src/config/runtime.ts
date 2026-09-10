export interface KoplaRuntimeConfig { bridgePublicUrl: string; chatwootWebhookUrl: string }

let runtimeConfig: KoplaRuntimeConfig | null = null;

const validBridgeUrl = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replace(/\/$/, '');
  if (/^\/(?!\/)/.test(normalized)) return normalized;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) ? normalized : '';
  } catch { return ''; }
};

const validWebhookUrl = (value: unknown) => {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString().replace(/\/$/, '') : '';
  } catch { return ''; }
};

export const loadRuntimeConfig = async (fetcher: typeof fetch = fetch): Promise<KoplaRuntimeConfig> => {
  const response = await fetcher('/bridge/config', { headers: { Accept: 'application/json' } });
  const body: unknown = await response.json().catch(() => null);
  const bridgePublicUrl = body && typeof body === 'object' ? validBridgeUrl((body as Record<string, unknown>).bridgePublicUrl) : '';
  const chatwootWebhookUrl = body && typeof body === 'object' ? validWebhookUrl((body as Record<string, unknown>).chatwootWebhookUrl) : '';
  if (!response.ok || !bridgePublicUrl || !chatwootWebhookUrl) throw new Error('A configuração runtime do bridge não está disponível.');
  runtimeConfig = { bridgePublicUrl, chatwootWebhookUrl };
  return runtimeConfig;
};

export const bridgePublicUrl = () => runtimeConfig?.bridgePublicUrl || '';
export const bridgeChatwootWebhookUrl = () => runtimeConfig?.chatwootWebhookUrl || '';

export const resetRuntimeConfigForTests = () => { runtimeConfig = null; };
