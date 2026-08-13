import 'dotenv/config';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value.replace(/\/$/, '');
};

export const config = {
  port: Number(process.env.BRIDGE_PORT || 3100),
  webhookSecret: required('BRIDGE_WEBHOOK_SECRET'),
  chatwootBaseUrl: required('CHATWOOT_BASE_URL'),
  chatwootAccountId: Number(required('CHATWOOT_ACCOUNT_ID')),
  chatwootApiAccessToken: required('CHATWOOT_API_ACCESS_TOKEN'),
  evolutionBaseUrl: required('EVOLUTION_BASE_URL'),
  evolutionApiKey: required('EVOLUTION_API_KEY'),
  dedupFile: process.env.BRIDGE_DEDUP_FILE || './bridge/data/evolution-message-ids.json',
  identityFile: process.env.BRIDGE_IDENTITY_FILE || './bridge/data/evolution-identities.json',
};

if (!Number.isInteger(config.chatwootAccountId) || config.chatwootAccountId < 1) throw new Error('CHATWOOT_ACCOUNT_ID deve ser um número positivo.');
