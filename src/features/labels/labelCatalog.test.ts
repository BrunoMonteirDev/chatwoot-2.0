// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LabelCatalog } from './labelCatalog';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('LabelCatalog', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });

  it('lista labels reais uma vez por account e não vaza cache entre contas', async () => {
    vi.mocked(fetch).mockImplementation((url) => json({ payload: [{ id: String(url).includes('/2/') ? 2 : 1, title: String(url).includes('/2/') ? 'financeiro' : 'vip', color: '#112233', description: 'Real' }] }));
    const catalog = new LabelCatalog();
    expect(await catalog.list(1)).toEqual([expect.objectContaining({ id: 1, title: 'vip', description: 'Real' })]);
    await catalog.list(1);
    expect(await catalog.list(2)).toEqual([expect.objectContaining({ id: 2, title: 'financeiro' })]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('cria, edita e exclui atualizando imediatamente o cache da account', async () => {
    vi.mocked(fetch)
      .mockImplementationOnce(() => json({ payload: [] }))
      .mockImplementationOnce(() => json({ id: 7, title: 'urgente', color: '#ff0000', description: 'Agora' }))
      .mockImplementationOnce(() => json({ id: 7, title: 'prioridade', color: '#00ff00', description: 'Editada' }))
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 200 })));
    const catalog = new LabelCatalog();
    const listener = vi.fn();
    catalog.subscribe(1, listener);
    await catalog.list(1);
    await catalog.create(1, { title: ' urgente ', color: '#ff0000', description: 'Agora' });
    expect(catalog.peek(1)?.map(label => label.title)).toEqual(['urgente']);
    expect(listener).toHaveBeenLastCalledWith([expect.objectContaining({ title: 'urgente' })]);
    await catalog.update(1, 7, { title: 'prioridade', color: '#00ff00', description: 'Editada' });
    expect(catalog.peek(1)).toEqual([expect.objectContaining({ id: 7, title: 'prioridade', color: '#00ff00' })]);
    await catalog.delete(1, 7);
    expect(catalog.peek(1)).toEqual([]);
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual({ label: { title: 'urgente', color: '#ff0000', description: 'Agora', show_on_sidebar: false } });
  });

  it('rejeita nome vazio e cor inválida antes da API', async () => {
    const catalog = new LabelCatalog();
    await expect(catalog.create(1, { title: ' ', color: '#00a884' })).rejects.toThrow('obrigatório');
    await expect(catalog.create(1, { title: 'vip', color: 'verde' })).rejects.toThrow('inválida');
    expect(fetch).not.toHaveBeenCalled();
  });
});
