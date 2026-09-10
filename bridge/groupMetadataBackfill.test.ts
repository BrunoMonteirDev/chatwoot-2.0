import { afterEach, describe, expect, it, vi } from 'vitest';
import { GroupMetadataBackfill, type GroupBackfillScope, type GroupBackfillTarget } from './groupMetadataBackfill';

const scope = (accountId = 1, inboxId = 10, sessionName = 'session-a'): GroupBackfillScope => ({ accountId, inboxId, sessionName });
const target = (groupJid: string, patch: Partial<GroupBackfillTarget> = {}): GroupBackfillTarget => ({ contactId: Number(groupJid.split('@')[0]), groupJid, participants: [], ...patch });

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('GroupMetadataBackfill', () => {
  it('popula grupo existente sem metadata mesmo sem mensagem nova', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    const worker = new GroupMetadataBackfill({ discover: vi.fn().mockResolvedValue([target('1@g.us')]), sync });
    await worker.reconcile(scope());
    expect(sync).toHaveBeenCalledWith(scope(), expect.objectContaining({ groupJid: '1@g.us' }));
  });

  it('processa vários grupos pendentes com concorrência baixa', async () => {
    let active = 0; let peak = 0; const releases: Array<() => void> = [];
    const sync = vi.fn().mockImplementation(async () => { active += 1; peak = Math.max(peak, active); await new Promise<void>(resolve => releases.push(resolve)); active -= 1; });
    const worker = new GroupMetadataBackfill({ discover: vi.fn().mockResolvedValue([target('1@g.us'), target('2@g.us'), target('3@g.us')]), sync }, { concurrency: 2 });
    const pending = worker.reconcile(scope());
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    releases.splice(0).forEach(release => release());
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(3));
    releases.splice(0).forEach(release => release());
    await pending;
    expect(peak).toBe(2);
  });

  it('ignora grupo que já possui snapshot sincronizado', async () => {
    const sync = vi.fn();
    const worker = new GroupMetadataBackfill({ discover: vi.fn().mockResolvedValue([target('1@g.us', { participants: [{ jid: '1@lid', phone: '5511999999999', contact_id: 9 }], syncedAt: new Date().toISOString() })]), sync });
    await worker.reconcile(scope());
    expect(sync).not.toHaveBeenCalled();
  });

  it('aplica retry com backoff exponencial após falha do provider', async () => {
    vi.useFakeTimers();
    const sync = vi.fn().mockRejectedValueOnce(new Error('provider down')).mockRejectedValueOnce(new Error('provider down')).mockResolvedValue(undefined);
    const worker = new GroupMetadataBackfill({ discover: vi.fn().mockResolvedValue([target('1@g.us')]), sync }, { baseDelayMs: 100, maxDelayMs: 1_000 });
    await worker.reconcile(scope());
    expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(99); expect(sync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(sync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(199); expect(sync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); expect(sync).toHaveBeenCalledTimes(3);
    worker.stop();
  });

  it('cancela retry quando outro fluxo já persistiu o snapshot', async () => {
    vi.useFakeTimers(); const stillPending = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    const sync = vi.fn().mockRejectedValueOnce(new Error('provider down'));
    const worker = new GroupMetadataBackfill({ discover: vi.fn().mockResolvedValue([target('1@g.us')]), sync, stillPending }, { baseDelayMs: 100 });
    await worker.reconcile(scope()); await vi.advanceTimersByTimeAsync(100);
    expect(stillPending).toHaveBeenCalledTimes(2); expect(sync).toHaveBeenCalledOnce(); worker.stop();
  });

  it('faz single-flight por account/inbox/session/group e mantém escopos isolados', async () => {
    const releases: Array<() => void> = [];
    const sync = vi.fn().mockImplementation(() => new Promise<void>(resolve => { releases.push(resolve); }));
    const worker = new GroupMetadataBackfill({ discover: vi.fn(), sync }); const item = target('1@g.us');
    const first = worker.run(scope(), item); const duplicate = worker.run(scope(), item);
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    const otherScope = worker.run(scope(2, 20, 'session-b'), item);
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    releases.forEach(release => release());
    await Promise.all([first, duplicate, otherScope]);
    expect(sync.mock.calls.map(call => call[0])).toEqual([scope(), scope(2, 20, 'session-b')]);
  });

  it('faz um fetch lógico e inclui todos os contatos legados do mesmo group JID', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    const worker = new GroupMetadataBackfill({ discover: vi.fn().mockResolvedValue([target('1@g.us', { contactId: 10 }), target('1@g.us', { contactId: 11 })]), sync });
    await worker.reconcile(scope());
    expect(sync).toHaveBeenCalledOnce(); expect(sync).toHaveBeenCalledWith(scope(), expect.objectContaining({ groupJid: '1@g.us', contactIds: [10, 11] }));
  });
});
