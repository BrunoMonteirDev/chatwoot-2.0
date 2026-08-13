// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatwootRealtimeClient, type WebSocketLike } from './realtime';

class FakeSocket implements WebSocketLike {
  readyState = 0;
  sent: string[] = [];
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; this.readyState = 3; this.onclose?.({} as CloseEvent); }
  open() { this.readyState = 1; this.onopen?.({} as Event); }
  receive(message: unknown) { this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent<string>); }
}

describe('ChatwootRealtimeClient', () => {
  afterEach(() => vi.useRealTimers());

  it('assina RoomChannel e entrega apenas envelopes ActionCable válidos', () => {
    const sockets: FakeSocket[] = [];
    const client = new ChatwootRealtimeClient({ websocketUrl: 'ws://chatwoot.test/cable', webSocketFactory: () => {
      const socket = new FakeSocket(); sockets.push(socket); return socket;
    } });
    const received = vi.fn();
    client.onEvent = received;
    client.connect({ accountId: 2, userId: 7, pubsubToken: 'pubsub' });
    sockets[0].open();
    expect(JSON.parse(sockets[0].sent[0])).toEqual({ command: 'subscribe', identifier: JSON.stringify({ channel: 'RoomChannel', pubsub_token: 'pubsub', account_id: 2, user_id: 7 }) });
    sockets[0].receive({ type: 'welcome' });
    sockets[0].receive({ message: { event: 'message.created', data: { id: 10 } } });
    expect(received).toHaveBeenCalledWith({ event: 'message.created', data: { id: 10 } });
  });

  it('reconecta uma vez após queda e troca a subscription ao mudar de account', () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const client = new ChatwootRealtimeClient({ websocketUrl: 'ws://chatwoot.test/cable', reconnectBaseMs: 10, presenceIntervalMs: 1000, webSocketFactory: () => {
      const socket = new FakeSocket(); sockets.push(socket); return socket;
    } });
    const reconnected = vi.fn();
    client.onReconnect = reconnected;
    client.connect({ accountId: 2, userId: 7, pubsubToken: 'first' });
    sockets[0].open();
    sockets[0].close();
    vi.advanceTimersByTime(10);
    expect(sockets).toHaveLength(2);
    sockets[1].open();
    expect(reconnected).toHaveBeenCalledTimes(1);
    client.connect({ accountId: 3, userId: 7, pubsubToken: 'second' });
    expect(sockets[1].closed).toBe(true);
    expect(sockets).toHaveLength(3);
    sockets[2].open();
    expect(JSON.parse(sockets[2].sent[0]).identifier).toContain('"account_id":3');
    client.disconnect();
  });
});
