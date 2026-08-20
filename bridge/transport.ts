import type { TransportCapabilities, WhatsAppTransport } from './providers.js';
import { TRANSPORT_CAPABILITIES } from './providers.js';

/**
 * Bridge-owned contract for WhatsApp transports. Existing Evolution and Meta
 * message adapters remain intact while each transport gradually implements the
 * operations it supports. Session lifecycle is intentionally optional because
 * the Cloud API has no QR/session concept.
 */
export interface WhatsAppSessionTransport<TSession = unknown, TQr = unknown> {
  health(): Promise<unknown>;
  listSessions(): Promise<TSession[]>;
  getSession(name: string): Promise<TSession>;
  createSession(input: { name: string; engine?: string }): Promise<TSession>;
  startSession(name: string): Promise<TSession>;
  restartSession(name: string): Promise<TSession>;
  logoutSession(name: string): Promise<TSession | null>;
  getQrCode(name: string): Promise<TQr>;
}

export interface WhatsAppTransportAdapter {
  readonly transport: WhatsAppTransport;
  readonly capabilities: TransportCapabilities;
  readonly sessions?: WhatsAppSessionTransport;
}

export const transportCapabilities = (transport: WhatsAppTransport) => TRANSPORT_CAPABILITIES[transport];

export const isTransportOperationSupported = (transport: WhatsAppTransport, capability: keyof TransportCapabilities) => transportCapabilities(transport)[capability];
