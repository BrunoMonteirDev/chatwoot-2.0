import { describe, expect, it } from 'vitest';
import { parseEmbeddedSignupEvent } from './embeddedSignup';

describe('Embedded Signup browser events', () => {
  it('aceita somente FINISH originado pelos domínios da Meta', () => {
    const event = { origin: 'https://www.facebook.com', data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'waba-1', phone_number_id: 'phone-1', business_id: 'business-1' } }) } as MessageEvent;
    expect(parseEmbeddedSignupEvent(event)).toEqual({ kind: 'finished', result: { onboardingMode: 'standard', wabaId: 'waba-1', phoneNumberId: 'phone-1', businessId: 'business-1' } });
  });

  it('ignora origem e payload inválidos sem executar conteúdo', () => {
    expect(parseEmbeddedSignupEvent({ origin: 'https://attacker.example', data: '{"type":"WA_EMBEDDED_SIGNUP"}' } as MessageEvent)).toBeNull();
    expect(parseEmbeddedSignupEvent({ origin: 'https://www.facebook.com', data: 'not-json' } as MessageEvent)).toBeNull();
    expect(parseEmbeddedSignupEvent({ origin: 'https://web.facebook.com', data: { type: 'WA_EMBEDDED_SIGNUP', event: 'CANCEL' } } as MessageEvent)).toEqual({ kind: 'cancelled' });
  });

  it('identifica coexistência somente pelo evento oficial da Meta', () => {
    const event = { origin: 'https://www.facebook.com', data: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { business_id: 'business-coexist', waba_id: 'waba-coexist' } } } as MessageEvent;
    expect(parseEmbeddedSignupEvent(event)).toEqual({ kind: 'finished', result: { onboardingMode: 'coexistence', wabaId: 'waba-coexist', phoneNumberId: null, businessId: 'business-coexist' } });
  });
});
