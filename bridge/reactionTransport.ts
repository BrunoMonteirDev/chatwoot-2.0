import { evolutionBridge, type EvolutionReactionTarget } from './evolution.js';
import type { WhatsAppTransport } from './providers.js';
import { metaCloud, type MetaCloudManualConfig } from './meta.js';

export class UnsupportedReactionTransportError extends Error {
  constructor(transport: WhatsAppTransport) {
    super(`Reações ainda não são suportadas pelo transport ${transport}.`);
    this.name = 'UnsupportedReactionTransportError';
  }
}

export interface ReactionTransportInput {
  transport: WhatsAppTransport;
  evolutionInstanceName?: string | null;
  metaConfig?: MetaCloudManualConfig | null;
  target: EvolutionReactionTarget;
}

interface ReactionTransport {
  send(input: ReactionTransportInput): Promise<void>;
}

const transports: Record<WhatsAppTransport, ReactionTransport> = {
  evolution: {
    async send({ evolutionInstanceName, target }) {
      if (!evolutionInstanceName) throw new Error('A inbox não possui uma instância Evolution configurada.');
      await evolutionBridge.sendReaction(evolutionInstanceName, target);
    },
  },
  meta_cloud: {
    async send({ metaConfig, target }) {
      if (!metaConfig) throw new UnsupportedReactionTransportError('meta_cloud');
      await metaCloud.sendReaction(metaConfig, target.remoteJid.replace(/\D/g, ''), target.messageId, target.emoji);
    },
  },
};

export const reactionTransport = {
  send: (input: ReactionTransportInput) => transports[input.transport].send(input),
};
