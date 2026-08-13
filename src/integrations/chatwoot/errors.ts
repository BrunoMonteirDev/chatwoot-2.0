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
    return error.validationErrors[0] || error.message;
  }
  if (error instanceof ChatwootNetworkError) return error.message;
  return 'Ocorreu um erro inesperado. Tente novamente.';
};
