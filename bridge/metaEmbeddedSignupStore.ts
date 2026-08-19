import { randomUUID } from 'node:crypto';
import { decryptBridgeValue, encryptBridgeValue } from './encryption.js';
import { bridgeRedis } from './redis.js';

export type MetaOnboardingMode = 'standard' | 'coexistence';
export type MetaEmbeddedSignupStage = 'started' | 'validated' | 'completed';

export interface MetaEmbeddedSignupSession {
  id: string;
  accountId: number;
  /** An existing inbox is immutable for the lifetime of this session. */
  inboxId: number | null;
  inboxName: string | null;
  onboardingMode: MetaOnboardingMode;
  createdAt: number;
  expiresAt: number;
  stage: MetaEmbeddedSignupStage;
  pending?: {
    config: { wabaId: string; phoneNumberId: string; accessToken: string };
    connection: { provider: 'meta_cloud'; wabaId: string; phoneNumberId: string; displayPhoneNumber: string | null; verifiedName: string | null; };
    webhookReady: boolean;
  };
}

export class MetaEmbeddedSignupSessionStore {
  private readonly values = new Map<string, MetaEmbeddedSignupSession>();

  constructor(private readonly ttlMs = 10 * 60 * 1000, private readonly now = () => Date.now()) {}

  async start(input: Pick<MetaEmbeddedSignupSession, 'accountId' | 'inboxId' | 'inboxName' | 'onboardingMode'>): Promise<MetaEmbeddedSignupSession> {
    this.purgeExpired();
    const timestamp = this.now();
    const session: MetaEmbeddedSignupSession = {
      id: randomUUID(), accountId: input.accountId, inboxId: input.inboxId, inboxName: input.inboxName,
      onboardingMode: input.onboardingMode, createdAt: timestamp, expiresAt: timestamp + this.ttlMs, stage: 'started',
    };
    await this.persist(session);
    return session;
  }

  async get(id: string): Promise<MetaEmbeddedSignupSession | null> {
    const session = await this.read(id);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      await this.remove(id);
      return null;
    }
    return session;
  }

  async save(session: MetaEmbeddedSignupSession) {
    if (!(await this.get(session.id))) throw new Error('A sessão de onboarding expirou ou não existe.');
    await this.persist(session);
  }

  async consume(id: string): Promise<MetaEmbeddedSignupSession | null> {
    const session = await this.get(id);
    if (!session) return null;
    await this.remove(id);
    return session;
  }

  permitsInbox(session: MetaEmbeddedSignupSession, inboxId: number) {
    return session.inboxId === null || session.inboxId === inboxId;
  }

  private purgeExpired() {
    for (const [id, session] of this.values) if (session.expiresAt <= this.now()) this.values.delete(id);
  }

  private key(id: string) { return `bridge:meta-embedded-signup:${id}`; }

  private async read(id: string): Promise<MetaEmbeddedSignupSession | null> {
    if (!bridgeRedis.enabled) return this.values.get(id) || null;
    const encrypted = await bridgeRedis.get(this.key(id));
    if (!encrypted) return null;
    try {
      const value: unknown = JSON.parse(decryptBridgeValue(encrypted));
      if (!value || typeof value !== 'object') return null;
      const session = value as MetaEmbeddedSignupSession;
      return typeof session.id === 'string' && typeof session.accountId === 'number' && typeof session.expiresAt === 'number' ? session : null;
    } catch {
      throw new Error('A sessão criptografada do Embedded Signup não pôde ser lida.');
    }
  }

  private async persist(session: MetaEmbeddedSignupSession) {
    if (bridgeRedis.enabled) {
      const ttlSeconds = Math.max(1, Math.ceil((session.expiresAt - this.now()) / 1000));
      await bridgeRedis.set(this.key(session.id), encryptBridgeValue(JSON.stringify(session)), ttlSeconds);
      return;
    }
    this.values.set(session.id, session);
  }

  private async remove(id: string) {
    if (bridgeRedis.enabled) await bridgeRedis.delete(this.key(id));
    else this.values.delete(id);
  }
}
