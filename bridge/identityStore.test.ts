import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { IdentityStore } from './identityStore';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))));

describe('IdentityStore local concurrency', () => {
  it('persiste aliases concorrentes sem colisão no arquivo temporário', async () => {
    const directory = await mkdtemp(`${tmpdir()}/synthetic-identities-`); directories.push(directory);
    const file = `${directory}/identities.json`; const store = new IdentityStore(file);
    await Promise.all([
      store.save(['scope-a:member-lid'], 'contact-a'),
      store.save(['scope-b:member-phone'], 'contact-b'),
      store.save(['scope-c:group'], 'contact-c'),
    ]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      'scope-a:member-lid': 'contact-a', 'scope-b:member-phone': 'contact-b', 'scope-c:group': 'contact-c',
    });
  });
});
