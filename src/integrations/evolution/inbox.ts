import type { Inbox } from '../../domain/currentUser';

export interface EvolutionInboxMetadata {
  evolution_provider: 'evolution';
  evolution_instance_name: string;
  evolution_instance_id?: string | null;
}

export const evolutionMetadataForInbox = (inbox: Inbox): EvolutionInboxMetadata | null => {
  const attributes = inbox.additionalAttributes;
  if (attributes.evolution_provider !== 'evolution' || typeof attributes.evolution_instance_name !== 'string' || !attributes.evolution_instance_name.trim()) return null;
  const instanceId = attributes.evolution_instance_id;
  return {
    evolution_provider: 'evolution',
    evolution_instance_name: attributes.evolution_instance_name,
    evolution_instance_id: typeof instanceId === 'string' ? instanceId : null,
  };
};

export const isEvolutionInbox = (inbox: Inbox) => inbox.channelType === 'Channel::Api' && evolutionMetadataForInbox(inbox) !== null;
