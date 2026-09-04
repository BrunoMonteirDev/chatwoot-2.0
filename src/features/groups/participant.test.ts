import { describe, expect, it } from 'vitest';
import { participantLabel, participantPhone } from './participant';

describe('participant presentation', () => {
  it('never renders a raw LID and only formats a real phone JID', () => {
    expect(participantPhone('19696904601705@lid')).toBe('');
    expect(participantLabel(undefined, '19696904601705@lid')).toBe('Participante');
    expect(participantLabel('Ana', '5511999999999@c.us')).toBe('Ana · +5511999999999');
  });
});
