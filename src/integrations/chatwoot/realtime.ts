export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface RealtimeSubscription {
  accountId: number;
  userId: number;
  pubsubToken: string;
}

export interface RealtimeEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
}

export interface RealtimeClientOptions {
  websocketUrl?: string;
  webSocketFactory?: (url: string) => WebSocketLike;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  presenceIntervalMs?: number;
}

const identifierFor = (subscription: RealtimeSubscription) => JSON.stringify({
  channel: 'RoomChannel', pubsub_token: subscription.pubsubToken, account_id: subscription.accountId, user_id: subscription.userId,
});

const defaultWebSocketUrl = () => {
  const configured = import.meta.env.VITE_CHATWOOT_WEBSOCKET_URL as string | undefined;
  if (configured) return configured.endsWith('/cable') ? configured : `${configured.replace(/\/$/, '')}/cable`;
  if (typeof window === 'undefined') return '/cable';
  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/cable`;
};

export class ChatwootRealtimeClient {
  private socket: WebSocketLike | null = null;
  private subscription: RealtimeSubscription | null = null;
  private stopped = true;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private presenceTimer: number | null = null;
  private status: RealtimeConnectionStatus = 'disconnected';
  private readonly websocketUrl: string;
  private readonly factory: (url: string) => WebSocketLike;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;
  private readonly presenceIntervalMs: number;
  onEvent: ((event: RealtimeEvent) => void) | null = null;
  onStatusChange: ((status: RealtimeConnectionStatus) => void) | null = null;
  onReconnect: (() => void) | null = null;

  constructor(options: RealtimeClientOptions = {}) {
    this.websocketUrl = options.websocketUrl || defaultWebSocketUrl();
    this.factory = options.webSocketFactory || ((url) => new WebSocket(url));
    this.reconnectBaseMs = options.reconnectBaseMs ?? 1000;
    this.reconnectMaxMs = options.reconnectMaxMs ?? 30_000;
    this.presenceIntervalMs = options.presenceIntervalMs ?? 20_000;
  }

  connect(subscription: RealtimeSubscription): void {
    const changed = this.subscription?.accountId !== subscription.accountId || this.subscription?.userId !== subscription.userId || this.subscription?.pubsubToken !== subscription.pubsubToken;
    if (!changed && this.socket && this.socket.readyState <= 1) return;
    this.disconnect();
    this.subscription = subscription;
    this.stopped = false;
    this.open(false);
  }

  disconnect(): void {
    this.stopped = true;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setStatus('disconnected');
  }

  private open(isReconnect: boolean): void {
    if (this.stopped || !this.subscription) return;
    this.setStatus(isReconnect ? 'reconnecting' : 'connecting');
    const socket = this.factory(this.websocketUrl);
    this.socket = socket;
    socket.onopen = () => {
      if (socket !== this.socket || !this.subscription) return;
      this.reconnectAttempts = 0;
      socket.send(JSON.stringify({ command: 'subscribe', identifier: identifierFor(this.subscription) }));
      this.startPresenceTimer();
      const reconnected = isReconnect;
      this.setStatus('connected');
      if (reconnected) this.onReconnect?.();
    };
    socket.onmessage = (message) => this.receive(message.data);
    socket.onerror = () => { /* close drives the retry lifecycle */ };
    socket.onclose = () => {
      if (socket !== this.socket || this.stopped) return;
      this.stopPresenceTimer();
      this.socket = null;
      this.scheduleReconnect();
    };
  }

  private receive(raw: string): void {
    let frame: unknown;
    try { frame = JSON.parse(raw); } catch { return; }
    if (!frame || typeof frame !== 'object') return;
    const message = (frame as { message?: unknown }).message;
    if (!message || typeof message !== 'object') return;
    const event = (message as { event?: unknown }).event;
    const data = (message as { data?: unknown }).data;
    if (typeof event !== 'string' || !data || typeof data !== 'object' || Array.isArray(data)) return;
    this.onEvent?.({ event, data: data as Record<string, unknown> });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    const delay = Math.min(this.reconnectBaseMs * 2 ** this.reconnectAttempts, this.reconnectMaxMs);
    this.reconnectAttempts += 1;
    this.setStatus('reconnecting');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open(true);
    }, delay);
  }

  private startPresenceTimer(): void {
    this.stopPresenceTimer();
    this.presenceTimer = window.setInterval(() => this.perform('update_presence'), this.presenceIntervalMs);
  }

  private stopPresenceTimer(): void {
    if (this.presenceTimer !== null) window.clearInterval(this.presenceTimer);
    this.presenceTimer = null;
  }

  private perform(action: string): void {
    if (!this.socket || this.socket.readyState !== 1 || !this.subscription) return;
    this.socket.send(JSON.stringify({ command: 'message', identifier: identifierFor(this.subscription), data: JSON.stringify({ action }) }));
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopPresenceTimer();
  }

  private setStatus(status: RealtimeConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.onStatusChange?.(status);
  }
}
