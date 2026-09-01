export type MetaOnboardingMode = 'standard' | 'coexistence';

export interface MetaEmbeddedSignupPublicConfig {
  appId: string;
  configurationId: string;
  graphApiVersion: string;
  embeddedSignupVersion: 4;
}

export interface MetaEmbeddedSignupEventResult {
  onboardingMode: MetaOnboardingMode;
  wabaId: string;
  phoneNumberId?: string | null;
  businessId?: string | null;
}

type FacebookLoginResponse = { authResponse?: { code?: string } | null; status?: string };
interface FacebookSdk {
  init(input: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void;
  login(callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>): void;
}

declare global { interface Window { FB?: FacebookSdk; fbAsyncInit?: () => void; } }

const SDK_ID = 'facebook-jssdk';
let sdkPromise: Promise<FacebookSdk> | null = null;

export class EmbeddedSignupError extends Error {}

const facebookOrigin = (origin: string) => origin === 'https://www.facebook.com' || origin === 'https://web.facebook.com';

export const parseEmbeddedSignupEvent = (event: MessageEvent<unknown>): { kind: 'finished'; result: MetaEmbeddedSignupEventResult } | { kind: 'cancelled' } | { kind: 'error' } | null => {
  if (!facebookOrigin(event.origin)) return null;
  let data: unknown = event.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return null; }
  }
  if (!data || typeof data !== 'object') return null;
  const payload = data as { type?: unknown; event?: unknown; data?: unknown };
  if (payload.type !== 'WA_EMBEDDED_SIGNUP') return null;
  if (payload.event === 'CANCEL') return { kind: 'cancelled' };
  if (payload.event === 'ERROR') return { kind: 'error' };
  const onboardingMode: MetaOnboardingMode | null = payload.event === 'FINISH' ? 'standard' : payload.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' ? 'coexistence' : null;
  if (!onboardingMode || !payload.data || typeof payload.data !== 'object') return null;
  const result = payload.data as { waba_id?: unknown; phone_number_id?: unknown; business_id?: unknown };
  if (typeof result.business_id !== 'string' || !result.business_id || typeof result.waba_id !== 'string' || !result.waba_id || (onboardingMode === 'standard' && (typeof result.phone_number_id !== 'string' || !result.phone_number_id))) return { kind: 'error' };
  return { kind: 'finished', result: { onboardingMode, wabaId: result.waba_id, phoneNumberId: typeof result.phone_number_id === 'string' ? result.phone_number_id : null, businessId: typeof result.business_id === 'string' ? result.business_id : null } };
};

export const listenForEmbeddedSignupEvents = (callback: (event: ReturnType<typeof parseEmbeddedSignupEvent>) => void) => {
  const listener = (event: MessageEvent<unknown>) => callback(parseEmbeddedSignupEvent(event));
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
};

export const loadFacebookSdk = (publicConfig: MetaEmbeddedSignupPublicConfig): Promise<FacebookSdk> => {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    const ready = () => {
      if (!window.FB) { reject(new EmbeddedSignupError('O SDK da Meta não foi disponibilizado pelo navegador.')); return; }
      window.FB.init({ appId: publicConfig.appId, cookie: true, xfbml: false, version: publicConfig.graphApiVersion });
      resolve(window.FB);
    };
    if (window.FB) { ready(); return; }
    const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', ready, { once: true }); existing.addEventListener('error', () => reject(new EmbeddedSignupError('Não foi possível carregar o SDK da Meta.')), { once: true }); return; }
    const script = document.createElement('script');
    script.id = SDK_ID; script.async = true; script.defer = true; script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', () => reject(new EmbeddedSignupError('Não foi possível carregar o SDK da Meta.')), { once: true });
    document.head.append(script);
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
};

export const openEmbeddedSignup = async (publicConfig: MetaEmbeddedSignupPublicConfig): Promise<string> => {
  const sdk = await loadFacebookSdk(publicConfig);
  return new Promise((resolve, reject) => {
    sdk.login(response => {
      const code = response.authResponse?.code;
      if (code) resolve(code);
      else reject(new EmbeddedSignupError(response.status === 'unknown' ? 'O popup foi bloqueado, fechado ou a autorização foi cancelada.' : 'A Meta não retornou um código de autorização.'));
    }, {
      config_id: publicConfig.configurationId,
      response_type: 'code',
      override_default_response_type: true,
      // Match Chatwoot's native Embedded Signup implementation. Meta decides
      // whether the terminal event is standard FINISH or coexistence onboarding.
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' },
    });
  });
};
