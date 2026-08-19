const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
import { authenticatedBridgeHeaders } from '../bridge/auth';

export interface MetaCloudManualConfig { inboxId: number; wabaId: string; phoneNumberId: string; accessToken: string; }
export interface MetaCloudConnection { provider: 'meta_cloud'; wabaId: string; phoneNumberId: string; displayPhoneNumber: string | null; verifiedName: string | null; }
export interface MetaEmbeddedSignupPublicConfig { appId: string; configurationId: string; graphApiVersion: string; embeddedSignupVersion: 4; }
export type MetaOnboardingMode = 'standard' | 'coexistence';
export interface MetaEmbeddedSignupResult { onboardingMode: MetaOnboardingMode; wabaId: string; phoneNumberId?: string | null; businessId?: string | null; }
export interface MetaEmbeddedSignupCompletion { connection: MetaCloudConnection; webhookReady: boolean; onboardingMode: MetaOnboardingMode; }
export interface MetaHistoryImportSummary { pending: number; processing: number; imported: number; failed: number; running: boolean; }

export class MetaCloudSetupError extends Error {}

const bridgeHeaders = () => {
  if (!bridgeUrl) throw new MetaCloudSetupError('O Cadastro Incorporado requer um bridge seguro configurado para este ambiente.');
  return authenticatedBridgeHeaders();
};

const readJson = async (response: Response): Promise<Record<string, unknown>> => {
  const body: unknown = await response.json().catch(() => ({}));
  return body && typeof body === 'object' ? body as Record<string, unknown> : {};
};

const connectionFrom = (value: unknown): MetaCloudConnection | null => {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.provider !== 'meta_cloud' || typeof input.wabaId !== 'string' || typeof input.phoneNumberId !== 'string') return null;
  // Copy only public fields. This is deliberately not a type assertion so a
  // future backend mistake cannot leak a credential through this client.
  return { provider: 'meta_cloud', wabaId: input.wabaId, phoneNumberId: input.phoneNumberId, displayPhoneNumber: typeof input.displayPhoneNumber === 'string' ? input.displayPhoneNumber : null, verifiedName: typeof input.verifiedName === 'string' ? input.verifiedName : null };
};

export const metaCloudSetup = {
  async validate(config: MetaCloudManualConfig): Promise<MetaCloudConnection> {
    if (!bridgeUrl) throw new MetaCloudSetupError('A configuração manual Meta requer um bridge seguro configurado para este ambiente.');
    const response = await fetch(`${bridgeUrl}/providers/meta/validate`, {
      method: 'POST', headers: bridgeHeaders(), body: JSON.stringify(config),
    });
    const body = await readJson(response);
    const connection = connectionFrom(body.connection);
    if (!response.ok || !connection) {
      throw new MetaCloudSetupError('Não foi possível validar as credenciais da API oficial da Meta. Confira WABA ID, Phone Number ID e token.');
    }
    return connection;
  },
  async embeddedPublicConfig(): Promise<MetaEmbeddedSignupPublicConfig> {
    if (!bridgeUrl) throw new MetaCloudSetupError('Configure a URL pública do bridge para usar o Cadastro Incorporado.');
    const response = await fetch(`${bridgeUrl}/meta/embedded-signup/config`);
    const body = await readJson(response);
    if (!response.ok || typeof body.appId !== 'string' || typeof body.configurationId !== 'string' || typeof body.graphApiVersion !== 'string' || body.embeddedSignupVersion !== 4) throw new MetaCloudSetupError('O Cadastro Incorporado não está configurado neste bridge.');
    return { appId: body.appId, configurationId: body.configurationId, graphApiVersion: body.graphApiVersion, embeddedSignupVersion: 4 };
  },
  async startEmbeddedSignup(input: { accountId: number; inboxId: number | null; inboxName?: string; onboardingMode: MetaOnboardingMode }): Promise<{ onboardingSession: string; expiresAt: number }> {
    const response = await fetch(`${bridgeUrl}/meta/embedded-signup/start`, { method: 'POST', headers: bridgeHeaders(), body: JSON.stringify(input) });
    const body = await readJson(response);
    if (!response.ok || typeof body.onboardingSession !== 'string' || typeof body.expiresAt !== 'number') throw new MetaCloudSetupError('Não foi possível iniciar o Cadastro Incorporado.');
    return { onboardingSession: body.onboardingSession, expiresAt: body.expiresAt };
  },
  async completeEmbeddedSignup(onboardingSession: string, code: string, publicResult: MetaEmbeddedSignupResult): Promise<MetaEmbeddedSignupCompletion> {
    const response = await fetch(`${bridgeUrl}/meta/embedded-signup/complete`, { method: 'POST', headers: bridgeHeaders(), body: JSON.stringify({ onboardingSession, code, publicResult }) });
    const body = await readJson(response);
    const connection = connectionFrom(body.connection);
    if (!response.ok || !connection || typeof body.webhookReady !== 'boolean' || (body.onboardingMode !== 'standard' && body.onboardingMode !== 'coexistence')) throw new MetaCloudSetupError('A Meta recusou a autorização ou não foi possível validar a conta selecionada.');
    return { connection, webhookReady: body.webhookReady, onboardingMode: body.onboardingMode };
  },
  async finalizeEmbeddedSignup(onboardingSession: string, inboxId: number): Promise<{ connection: MetaCloudConnection; webhookReady: boolean }> {
    const response = await fetch(`${bridgeUrl}/meta/embedded-signup/finalize`, { method: 'POST', headers: bridgeHeaders(), body: JSON.stringify({ onboardingSession, inboxId }) });
    const body = await readJson(response);
    const connection = connectionFrom(body.connection);
    if (!response.ok || !connection || typeof body.webhookReady !== 'boolean') throw new MetaCloudSetupError('A autorização foi validada, mas não foi possível vincular a inbox.');
    return { connection, webhookReady: body.webhookReady };
  },
  async historySummary(inboxId: number): Promise<MetaHistoryImportSummary> {
    const response = await fetch(`${bridgeUrl}/meta/history/${inboxId}`, { headers: authenticatedBridgeHeaders() });
    const body = await readJson(response);
    if (!response.ok || !['pending', 'processing', 'imported', 'failed', 'running'].every(key => typeof body[key] === 'number' || key === 'running' && typeof body[key] === 'boolean')) throw new MetaCloudSetupError('Não foi possível consultar o histórico da Meta.');
    return { pending: body.pending as number, processing: body.processing as number, imported: body.imported as number, failed: body.failed as number, running: body.running as boolean };
  },
  async importHistory(inboxId: number, retryFailed = false): Promise<MetaHistoryImportSummary> {
    const response = await fetch(`${bridgeUrl}/meta/history/${inboxId}/import`, { method: 'POST', headers: bridgeHeaders(), body: JSON.stringify({ retryFailed }) });
    const body = await readJson(response);
    if (!response.ok || typeof body.pending !== 'number' || typeof body.processing !== 'number' || typeof body.imported !== 'number' || typeof body.failed !== 'number') throw new MetaCloudSetupError('Não foi possível iniciar a sincronização do histórico.');
    return { pending: body.pending, processing: body.processing, imported: body.imported, failed: body.failed, running: body.running === true };
  },
};
