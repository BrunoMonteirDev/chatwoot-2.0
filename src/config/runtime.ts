export interface KoplaRuntimeConfig { bridgePublicUrl: string }

const buildTimeBridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
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

export const loadRuntimeConfig = async (fetcher: typeof fetch = fetch): Promise<KoplaRuntimeConfig> => {
  const bootstrapBase = buildTimeBridgeUrl || '/bridge';
  const response = await fetcher(`${bootstrapBase}/config`, { headers: { Accept: 'application/json' } });
  const body: unknown = await response.json().catch(() => null);
  const bridgePublicUrl = body && typeof body === 'object' ? validBridgeUrl((body as Record<string, unknown>).bridgePublicUrl) : '';
  if (!response.ok || !bridgePublicUrl) throw new Error('A configuração runtime do bridge não está disponível.');
  runtimeConfig = { bridgePublicUrl };
  return runtimeConfig;
};

export const bridgePublicUrl = () => runtimeConfig?.bridgePublicUrl || buildTimeBridgeUrl;

export const resetRuntimeConfigForTests = () => { runtimeConfig = null; };
