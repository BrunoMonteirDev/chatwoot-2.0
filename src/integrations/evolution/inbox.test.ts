import { describe, expect, it } from 'vitest';
import { evolutionMetadataForInbox, isEvolutionInbox } from './inbox';

const baseInbox = { id: 1, name: 'Suporte', avatarUrl: null, channelType: 'Channel::Api', channelId: 1, webhookUrl: null, inboxIdentifier: 'token', additionalAttributes: {} };

describe('Evolution inbox identification', () => {
  it('não identifica Channel::Api sem metadados Evolution', () => {
    expect(isEvolutionInbox(baseInbox)).toBe(false);
    expect(evolutionMetadataForInbox(baseInbox)).toBeNull();
  });

  it('identifica Channel::Api com evolution_provider=evolution', () => {
    const inbox = { ...baseInbox, additionalAttributes: { evolution_provider: 'evolution', evolution_instance_name: 'cw-suporte', evolution_instance_id: 'instance-id' } };
    expect(isEvolutionInbox(inbox)).toBe(true);
    expect(evolutionMetadataForInbox(inbox)).toEqual({ evolution_provider: 'evolution', evolution_instance_name: 'cw-suporte', evolution_instance_id: 'instance-id' });
  });
});
