import { authSession } from './authSession';
import { ChatwootApiError, ChatwootNetworkError } from './errors';
import type { AuthSession } from './types';

const AUTH_HEADERS = ['access-token', 'token-type', 'client', 'expiry', 'uid'] as const;
const DEFAULT_TIMEOUT_MS = 15_000;

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object;
  timeoutMs?: number;
};

export class ChatwootApiClient {
  constructor(private readonly baseUrl = import.meta.env.VITE_CHATWOOT_BASE_URL || '') {}

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, body?: RequestOptions['body'], options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  async put<T>(path: string, body?: RequestOptions['body'], options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  async patch<T>(path: string, body?: RequestOptions['body'], options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    this.applyAuthHeaders(headers, authSession.get());

    let body: BodyInit | undefined;
    if (options.body instanceof FormData || typeof options.body === 'string' || options.body instanceof URLSearchParams) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        body,
        credentials: 'same-origin',
        signal: options.signal ?? controller.signal,
      });
      this.captureAuthHeaders(response.headers);
      const responseBody = await parseBody(response);
      if (!response.ok) {
        throw new ChatwootApiError({
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          message: messageFromBody(responseBody, response.statusText),
        });
      }
      return responseBody as T;
    } catch (error) {
      if (error instanceof ChatwootApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ChatwootNetworkError('A conexão com o Chatwoot excedeu o tempo limite.');
      }
      throw new ChatwootNetworkError();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private applyAuthHeaders(headers: Headers, session: AuthSession | null): void {
    if (!session) return;
    headers.set('access-token', session.accessToken);
    headers.set('token-type', session.tokenType);
    headers.set('client', session.client);
    headers.set('expiry', session.expiry);
    headers.set('uid', session.uid);
  }

  private captureAuthHeaders(headers: Headers): void {
    const current = authSession.get();
    const values = AUTH_HEADERS.map((header) => headers.get(header));
    if (values.some((value) => value === null)) return;

    authSession.set({
      accessToken: values[0]!,
      tokenType: values[1]!,
      client: values[2]!,
      expiry: values[3]!,
      uid: values[4]!,
    });

    // A resposta pode renovar somente parte dos headers. Nesse caso, conserva-se a sessão válida atual.
    if (!current) return;
  }
}

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
};

const messageFromBody = (body: unknown, fallback: string): string => {
  if (body && typeof body === 'object') {
    const data = body as { message?: unknown; error?: unknown; errors?: unknown };
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
    if (Array.isArray(data.errors) && typeof data.errors[0] === 'string') return data.errors[0];
  }
  return fallback || 'A requisição ao Chatwoot falhou.';
};

export const chatwootApiClient = new ChatwootApiClient();
