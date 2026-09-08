import { describe, expect, it } from 'vitest';
import { composerNotice, composerPresentation } from './composerCapability';

const capability = (reason: string | null, allowed = false) => ({ applicable: true, can_send_message: allowed, can_send_freeform: allowed, requires_template: reason === 'outside_window_template', template_required: reason === 'outside_window_template', send_block_reason: reason, required_transport: 'waha' as const, connection_state: 'disconnected' });

describe('composer capability notice', () => {
  it('keeps normal Meta and internal notes editable', () => { expect(composerNotice(capability(null, true), null, false)).toBeNull(); expect(composerNotice(capability('waha_disconnected'), null, true)).toBeNull(); });
  it('identifies a closed Meta window as a template requirement, not a disconnected provider', () => {
    const notice = composerNotice(capability('outside_window_template'), null, false);
    expect(notice).toMatchObject({
      title: 'Esta conversa está fora da janela de 24 horas.', action: 'template'
    });
    expect(composerPresentation(notice)).toEqual({ templateOnly: true, showFreeform: false, showDisconnectedStatus: false });
  });
  it('restores the freeform composer when Meta allows it', () => {
    expect(composerPresentation(composerNotice(capability(null, true), null, false))).toEqual({ templateOnly: false, showFreeform: true, showDisconnectedStatus: false });
  });
  it('keeps Meta reauthorization and disconnection messages specific', () => {
    expect(composerNotice(capability('reauthorization_required'), null, false)).toMatchObject({ description: 'A conexão com a Meta precisa ser reautorizada.' });
    expect(composerNotice(capability('meta_disconnected'), null, false)).toMatchObject({ description: 'Reconecte a conta Meta para voltar a enviar mensagens.' });
  });
  it('renders the server supplied blocked states without a transport selector', () => {
    expect(composerNotice(capability('outside_window_template'), null, false)).toMatchObject({ action: 'template' });
    expect(composerNotice(capability('reauthorization_required'), null, false)).toMatchObject({ action: 'manager' });
    expect(composerNotice(capability('meta_disconnected'), null, false)).toMatchObject({ action: 'manager' });
    expect(composerNotice(capability('waha_missing'), null, false)).toMatchObject({ action: 'manager' });
    expect(composerNotice(capability('waha_disconnected'), null, false)?.description).toContain('WAHA');
  });
});
