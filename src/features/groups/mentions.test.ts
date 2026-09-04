import { describe, expect, it } from 'vitest';
import { mentionReplacements, mentionTargetFor, pruneMentionSelections, uniqueMentionTargets } from './mentions';

describe('group mentions', () => {
  it('keeps a provider identity separate from the friendly token and uses its supplied phone JID', () => {
    const selection = { providerId: 'lid-1@lid', phoneJid: '5511999999999@c.us', token: '@Bruno' };
    expect(mentionTargetFor(selection)).toBe('5511999999999@c.us');
    expect(uniqueMentionTargets([selection])).toEqual(['5511999999999@c.us']);
    expect(mentionReplacements([selection])).toEqual([{ token: '@Bruno', text: '@5511999999999' }]);
  });

  it('never turns a LID into a phone mention', () => {
    const selection = { providerId: '19696904601705@lid', token: '@Participante' };
    expect(mentionTargetFor(selection)).toBeUndefined();
    expect(uniqueMentionTargets([selection])).toEqual([]);
    expect(mentionReplacements([selection])).toEqual([]);
  });

  it('keeps multiple distinct targets and removes IDs whose token was deleted', () => {
    const selections = [
      { providerId: '5511999999999@c.us', token: '@Ana' },
      { providerId: '5521999999999@c.us', token: '@Bia' },
    ];
    expect(uniqueMentionTargets(selections)).toEqual(['5511999999999@c.us', '5521999999999@c.us']);
    expect(pruneMentionSelections('Olá @Bia', selections)).toEqual([selections[1]]);
  });
});
