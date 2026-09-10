export type GroupBackfillScope = { accountId: number; inboxId: number; sessionName: string };
export type GroupBackfillTarget = {
  contactId: number;
  contactIds?: number[];
  groupJid: string;
  participants: unknown[];
  historicalParticipants?: unknown[];
  syncedAt?: string;
  subject?: string;
  description?: string;
  avatarUrl?: string;
};

type Timer = ReturnType<typeof setTimeout>;
type Dependencies = {
  discover: (scope: GroupBackfillScope) => Promise<GroupBackfillTarget[]>;
  sync: (scope: GroupBackfillScope, target: GroupBackfillTarget) => Promise<void>;
  stillPending?: (scope: GroupBackfillScope, target: GroupBackfillTarget) => Promise<boolean>;
  log?: Pick<Console, 'info' | 'warn'>;
};

export const validPersistedGroupSnapshot = (target: GroupBackfillTarget) =>
  target.participants.length > 0 && typeof target.syncedAt === 'string' && Number.isFinite(Date.parse(target.syncedAt))
  && target.participants.every(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const participant = value as Record<string, unknown>;
    return typeof participant.jid === 'string' && (typeof participant.phone === 'string' || typeof participant.phone_jid === 'string')
      && typeof participant.contact_id === 'number' && participant.contact_id > 0;
  });

// A process-local queue is enough to prevent duplicate provider reads in one
// bridge replica. Persistence is the cross-restart idempotency boundary: each
// reconciliation rediscovers only contacts without a complete snapshot.
export class GroupMetadataBackfill {
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly retryTimers = new Map<string, Timer>();
  private readonly attempts = new Map<string, number>();

  constructor(
    private readonly dependencies: Dependencies,
    private readonly options: { concurrency?: number; baseDelayMs?: number; maxDelayMs?: number } = {},
  ) {}

  private key(scope: GroupBackfillScope, target: GroupBackfillTarget) {
    return `${scope.accountId}:${scope.inboxId}:${scope.sessionName}:${target.groupJid}`;
  }

  async reconcile(scope: GroupBackfillScope) {
    const grouped = new Map<string, GroupBackfillTarget>();
    (await this.dependencies.discover(scope)).filter(target => !validPersistedGroupSnapshot(target)).forEach(target => {
      const existing = grouped.get(target.groupJid);
      if (!existing) { grouped.set(target.groupJid, { ...target, contactIds: [target.contactId] }); return; }
      const contactIds = [...new Set([...(existing.contactIds || [existing.contactId]), target.contactId])];
      grouped.set(target.groupJid, target.participants.length > existing.participants.length ? { ...target, contactIds } : { ...existing, contactIds });
    });
    const targets = [...grouped.values()];
    const concurrency = Math.max(1, Math.min(this.options.concurrency || 2, 4));
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++];
        await this.run(scope, target);
      }
    }));
  }

  run(scope: GroupBackfillScope, target: GroupBackfillTarget): Promise<void> {
    const key = this.key(scope, target);
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const pending = (async () => {
      if (this.dependencies.stillPending && !(await this.dependencies.stillPending(scope, target))) return;
      await this.dependencies.sync(scope, target);
    })().then(() => {
      this.attempts.delete(key);
      const timer = this.retryTimers.get(key);
      if (timer) clearTimeout(timer);
      this.retryTimers.delete(key);
      this.dependencies.log?.info('[groups] metadata backfill complete', { ...scope, groupJid: target.groupJid });
    }).catch(error => {
      const attempt = (this.attempts.get(key) || 0) + 1;
      this.attempts.set(key, attempt);
      const delay = Math.min((this.options.baseDelayMs || 5_000) * (2 ** (attempt - 1)), this.options.maxDelayMs || 5 * 60_000);
      if (!this.retryTimers.has(key)) {
        const timer = setTimeout(() => {
          this.retryTimers.delete(key);
          void this.run(scope, target);
        }, delay);
        timer.unref?.();
        this.retryTimers.set(key, timer);
      }
      this.dependencies.log?.warn('[groups] metadata backfill retry scheduled', { ...scope, groupJid: target.groupJid, attempt, delay, error: error instanceof Error ? error.message : 'unknown' });
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }

  stop() {
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
  }
}
