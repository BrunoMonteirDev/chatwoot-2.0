export class ChatwootApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  readonly validationErrors: string[];

  constructor({ status, statusText, body, message }: {
    status: number;
    statusText: string;
    body: unknown;
    message: string;
  }) {
    super(message);
    this.name = 'ChatwootApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.validationErrors = extractValidationErrors(body);
  }
}

export class ChatwootNetworkError extends Error {
  constructor(message = 'Não foi possível conectar ao Chatwoot.') {
    super(message);
    this.name = 'ChatwootNetworkError';
  }
}

// The WhatsApp bridge is a separate authenticated backend. It returns only
// sanitized messages, so exposing its explicit operational error to the UI is
// useful (and avoids turning every 4xx/5xx into an unhelpful generic alert).
export class BridgeApiError extends Error {
  constructor(readonly status: number, readonly body: unknown, message: string) {
    super(message);
    this.name = 'BridgeApiError';
  }
}

const extractValidationErrors = (body: unknown): string[] => {
  if (!body || typeof body !== 'object') return [];
  const candidate = body as { errors?: unknown; error?: unknown; message?: unknown };
  if (Array.isArray(candidate.errors)) return candidate.errors.filter((value): value is string => typeof value === 'string');
  if (typeof candidate.error === 'string') return [candidate.error];
  if (typeof candidate.message === 'string') return [candidate.message];
  return [];
};

export const errorMessageForUser = (error: unknown): string => {
  if (error instanceof ChatwootApiError) {
    if (error.status === 401) return 'E-mail ou senha inválidos, ou sua sessão expirou.';
    if (error.status === 403) return 'Você não tem permissão para realizar esta ação.';
    if (error.status === 402 || /(?:account )?limit exceeded|limite (?:de )?(?:agentes|caixas)/i.test(error.validationErrors[0] || error.message)) {
      return 'O limite desta conta foi atingido. Fale com o suporte para ampliar o limite.';
    }
    return error.validationErrors[0] || error.message;
  }
  if (error instanceof BridgeApiError) {
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente para administrar esta conexão.';
    if (error.status === 403) return 'Esta conexão WAHA não está disponível para esta caixa de entrada.';
    return error.message;
  }
  if (error instanceof ChatwootNetworkError) return error.message;
  return 'Ocorreu um erro inesperado. Tente novamente.';
};
