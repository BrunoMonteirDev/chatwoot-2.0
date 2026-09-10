export type GroupMetadataBootstrapResult = 'already_persisted' | 'bootstrapped' | 'deferred';

export class GroupMetadataBootstrap {
  private readonly completed = new Set<string>();
  private readonly pending = new Map<string, Promise<GroupMetadataBootstrapResult>>();
  private readonly retryAt = new Map<string, number>();

  constructor(private readonly retryDelayMs = 60_000, private readonly now = () => Date.now()) {}

  async run(scope: string, persisted: () => Promise<boolean>, bootstrap: () => Promise<boolean>): Promise<GroupMetadataBootstrapResult> {
    if (this.completed.has(scope)) return 'already_persisted';
    const inFlight = this.pending.get(scope);
    if (inFlight) return inFlight;
    if ((this.retryAt.get(scope) || 0) > this.now()) return 'deferred';

    const next = (async () => {
      if (await persisted()) {
        this.completed.add(scope);
        this.retryAt.delete(scope);
        return 'already_persisted' as const;
      }
      if (await bootstrap()) {
        this.completed.add(scope);
        this.retryAt.delete(scope);
        return 'bootstrapped' as const;
      }
      this.retryAt.set(scope, this.now() + this.retryDelayMs);
      return 'deferred' as const;
    })().catch((error) => {
      this.retryAt.set(scope, this.now() + this.retryDelayMs);
      throw error;
    }).finally(() => this.pending.delete(scope));

    this.pending.set(scope, next);
    return next;
  }
}
