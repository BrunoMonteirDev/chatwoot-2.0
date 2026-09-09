import { describe, expect, it, vi } from 'vitest';
import { updateConversationLabelsOptimistically } from './conversationLabels';

describe('conversation labels', () => {
  it('adiciona sem duplicar e reconcilia a resposta real', async () => {
    const apply = vi.fn();
    await updateConversationLabelsOptimistically(['vip'], ['vip', 'urgente', 'urgente'], apply, async labels => ({ labels }));
    expect(apply.mock.calls).toEqual([[['vip', 'urgente']], [['vip', 'urgente']]]);
  });

  it('remove otimisticamente e restaura labels quando a API falha', async () => {
    const apply = vi.fn();
    await expect(updateConversationLabelsOptimistically(['vip', 'urgente'], ['vip'], apply, async () => { throw new Error('falha'); })).rejects.toThrow('falha');
    expect(apply.mock.calls).toEqual([[['vip']], [['vip', 'urgente']]]);
  });
});
