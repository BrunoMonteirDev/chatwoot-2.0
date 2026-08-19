type Labels = Record<string, string | number | boolean>;

const keyFor = (name: string, labels: Labels) => `${name}{${Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${String(value)}`).join(',')}}`;

export class BridgeMetrics {
  private readonly values = new Map<string, number>();

  increment(name: string, labels: Labels = {}) {
    const key = keyFor(name, labels);
    this.values.set(key, (this.values.get(key) || 0) + 1);
  }

  snapshot() {
    return Object.fromEntries(this.values);
  }
}

export const bridgeMetrics = new BridgeMetrics();
