import { describe, expect, it } from 'vitest';
import { composerNotice } from './composerCapability';

const capability = (reason: string | null, allowed = false) => ({ applicable: true, can_send_message: allowed, can_send_freeform: allowed, requires_template: reason === 'outside_window_template', template_required: reason === 'outside_window_template', send_block_reason: reason, required_transport: 'waha' as const, connection_state: 'disconnected' });

describe('composer capability notice', () => {
  it('keeps normal Meta and internal notes editable', () => { expect(composerNotice(capability(null, true), null, false)).toBeNull(); expect(composerNotice(capability('waha_disconnected'), null, true)).toBeNull(); });
  it('renders the server supplied blocked states without a transport selector', () => {
    expect(composerNotice(capability('outside_window_template'), null, false)).toMatchObject({ action: 'template' });
    expect(composerNotice(capability('reauthorization_required'), null, false)).toMatchObject({ action: 'manager' });
    expect(composerNotice(capability('meta_disconnected'), null, false)).toMatchObject({ action: 'manager' });
    expect(composerNotice(capability('waha_missing'), null, false)).toMatchObject({ action: 'manager' });
    expect(composerNotice(capability('waha_disconnected'), null, false)?.description).toContain('WAHA');
  });
});
