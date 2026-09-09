type CacheSource = 'ram' | 'indexeddb' | 'network';

type OpeningMeasurement = {
  accountId: number;
  conversationId: number;
  clickedAt: number;
  headerRendered: boolean;
  messagesRendered: boolean;
  cacheSource?: CacheSource;
};

const measurements = new Map<string, OpeningMeasurement>();
const keyFor = (accountId: number, conversationId: number) => `${accountId}:${conversationId}`;

const report = (event: string, measurement: OpeningMeasurement, extra: Record<string, unknown> = {}) => {
  if (!import.meta.env.DEV) return;
  try {
    console.debug('[conversation-opening]', {
      event,
      accountId: measurement.accountId,
      conversationId: measurement.conversationId,
      elapsedMs: Math.round(performance.now() - measurement.clickedAt),
      ...extra,
    });
  } catch {
    // Development instrumentation must never affect conversation opening.
  }
};

export const conversationOpeningMetrics = {
  click(accountId: number, conversationId: number) {
    if (!import.meta.env.DEV) return;
    const measurement = { accountId, conversationId, clickedAt: performance.now(), headerRendered: false, messagesRendered: false };
    measurements.set(keyFor(accountId, conversationId), measurement);
    report('conversation_click', measurement);
  },

  headerRendered(accountId: number, conversationId: number) {
    const measurement = measurements.get(keyFor(accountId, conversationId));
    if (!measurement || measurement.headerRendered) return;
    measurement.headerRendered = true;
    report('header_rendered', measurement);
  },

  cacheSource(accountId: number, conversationId: number, source: CacheSource) {
    const measurement = measurements.get(keyFor(accountId, conversationId));
    if (!measurement || measurement.cacheSource) return;
    measurement.cacheSource = source;
    report('cache_source', measurement, { source });
  },

  messagesRendered(accountId: number, conversationId: number) {
    const measurement = measurements.get(keyFor(accountId, conversationId));
    if (!measurement || measurement.messagesRendered) return;
    measurement.messagesRendered = true;
    report('messages_first_render', measurement, { source: measurement.cacheSource || 'network' });
  },
};
