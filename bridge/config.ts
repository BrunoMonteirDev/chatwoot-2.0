import 'dotenv/config';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value.replace(/\/$/, '');
};

const optionalUrl = (name: string) => (process.env[name] || '').replace(/\/$/, '');

export const config = {
  port: Number(process.env.BRIDGE_PORT || 3100),
  publicUrl: (process.env.BRIDGE_PUBLIC_URL || '').replace(/\/$/, ''),
  // Container-to-container webhooks stay on the private Compose network.
  // BRIDGE_PUBLIC_URL remains only for access from outside Docker.
  internalUrl: optionalUrl('BRIDGE_INTERNAL_URL'),
  webhookSecret: required('BRIDGE_WEBHOOK_SECRET'),
  chatwootBaseUrl: required('CHATWOOT_BASE_URL'),
  // Kept only as a migration fallback for existing single-account installs.
  // New operations resolve the account from the authenticated request or
  // from the persisted WAHA session ownership.
  chatwootDefaultAccountId: process.env.CHATWOOT_ACCOUNT_ID ? Number(process.env.CHATWOOT_ACCOUNT_ID) : null,
  chatwootApiAccessToken: required('CHATWOOT_API_ACCESS_TOKEN'),
  // Evolution is a legacy transport. New WAHA-only installations must be
  // able to boot without provisioning an Evolution API.
  evolutionBaseUrl: optionalUrl('EVOLUTION_BASE_URL'),
  evolutionApiKey: process.env.EVOLUTION_API_KEY || '',
  // WAHA is optional during the Evolution-to-WAHA migration. Requiring it at
  // bridge boot would break existing Evolution and Meta installations.
  wahaBaseUrl: optionalUrl('WAHA_BASE_URL'),
  wahaApiKey: process.env.WAHA_API_KEY || '',
  wahaWebhookSecret: process.env.WAHA_WEBHOOK_SECRET || '',
  wahaDefaultEngine: process.env.WAHA_DEFAULT_ENGINE || 'GOWS',
  wahaRequestTimeoutMs: Number(process.env.WAHA_REQUEST_TIMEOUT_MS || 15_000),
  wahaHistoryFile: process.env.BRIDGE_WAHA_HISTORY_FILE || './bridge/data/waha-history-imports.json',
  wahaHistoryPageSize: Number(process.env.WAHA_HISTORY_PAGE_SIZE || 100),
  wahaHistoryMessageConcurrency: Number(process.env.WAHA_HISTORY_MESSAGE_CONCURRENCY || 4),
  dedupFile: process.env.BRIDGE_DEDUP_FILE || './bridge/data/evolution-message-ids.json',
  identityFile: process.env.BRIDGE_IDENTITY_FILE || './bridge/data/evolution-identities.json',
  // Ownership is security state, not UI metadata. Keep the local fallback in
  // the bridge data volume; production uses the encrypted Redis document.
  wahaSessionOwnershipFile: process.env.BRIDGE_WAHA_SESSION_OWNERSHIP_FILE || './bridge/data/waha-session-ownerships.json',
  metaGraphVersion: process.env.META_GRAPH_VERSION || 'v22.0',
  metaConfigFile: process.env.BRIDGE_META_CONFIG_FILE || './bridge/data/meta-cloud-config.json',
  metaHistoryFile: process.env.BRIDGE_META_HISTORY_FILE || './bridge/data/meta-history-staging.json',
  historyImportBatchSize: Number(process.env.HISTORY_IMPORT_BATCH_SIZE || 100),
  historyMediaConcurrency: Number(process.env.HISTORY_MEDIA_CONCURRENCY || 3),
  maxMediaBytes: Number(process.env.BRIDGE_MAX_MEDIA_BYTES || 32 * 1024 * 1024),
  // Vite picks the first free development port. Rails owns :3000 in this
  // workspace, so the custom frontend normally runs on :3002. Keep this
  // explicit development allow-list; production still requires configured
  // origins and never falls back to a wildcard.
  allowedOrigins: (process.env.BRIDGE_ALLOWED_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000,http://localhost:3002')).split(',').map(value => value.trim()).filter(Boolean),
  redisUrl: process.env.BRIDGE_REDIS_URL || '',
  encryptionKey: process.env.BRIDGE_ENCRYPTION_KEY || '',
  // App ID and Embedded Signup configuration ID are public browser inputs,
  // but are served by the bridge so they are not duplicated in Vite bundles.
  metaAppId: process.env.META_APP_ID || '',
  metaEmbeddedSignupConfigId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || '',
  metaEmbeddedSignupSessionTtlMs: Number(process.env.META_EMBEDDED_SIGNUP_SESSION_TTL_SECONDS || 600) * 1000,
  // Tokens remain server-side. For local development the bridge secret is a
  // compatibility fallback for the Meta verification challenge; production
  // deployments must set META_WEBHOOK_VERIFY_TOKEN and META_APP_SECRET.
  metaWebhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || process.env.BRIDGE_WEBHOOK_SECRET || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
};

if (config.chatwootDefaultAccountId !== null && (!Number.isInteger(config.chatwootDefaultAccountId) || config.chatwootDefaultAccountId < 1)) throw new Error('CHATWOOT_ACCOUNT_ID deve ser um número positivo.');
if (!Number.isFinite(config.metaEmbeddedSignupSessionTtlMs) || config.metaEmbeddedSignupSessionTtlMs < 60_000) throw new Error('META_EMBEDDED_SIGNUP_SESSION_TTL_SECONDS deve ser pelo menos 60.');
if (!Number.isInteger(config.historyImportBatchSize) || config.historyImportBatchSize < 1 || config.historyImportBatchSize > 1_000) throw new Error('HISTORY_IMPORT_BATCH_SIZE deve estar entre 1 e 1000.');
if (!Number.isInteger(config.historyMediaConcurrency) || config.historyMediaConcurrency < 1 || config.historyMediaConcurrency > 10) throw new Error('HISTORY_MEDIA_CONCURRENCY deve estar entre 1 e 10.');
if (!Number.isInteger(config.maxMediaBytes) || config.maxMediaBytes < 1_024 * 1_024 || config.maxMediaBytes > 100 * 1024 * 1024) throw new Error('BRIDGE_MAX_MEDIA_BYTES deve estar entre 1MB e 100MB.');
if (!Number.isInteger(config.wahaRequestTimeoutMs) || config.wahaRequestTimeoutMs < 1_000 || config.wahaRequestTimeoutMs > 120_000) throw new Error('WAHA_REQUEST_TIMEOUT_MS deve estar entre 1000 e 120000.');
if (!Number.isInteger(config.wahaHistoryPageSize) || config.wahaHistoryPageSize < 1 || config.wahaHistoryPageSize > 1_000) throw new Error('WAHA_HISTORY_PAGE_SIZE deve estar entre 1 e 1000.');
if (!Number.isInteger(config.wahaHistoryMessageConcurrency) || config.wahaHistoryMessageConcurrency < 1 || config.wahaHistoryMessageConcurrency > 10) throw new Error('WAHA_HISTORY_MESSAGE_CONCURRENCY deve estar entre 1 e 10.');
if (process.env.NODE_ENV === 'production' && !config.allowedOrigins.length) throw new Error('BRIDGE_ALLOWED_ORIGINS é obrigatório em produção.');
if (process.env.NODE_ENV === 'production' && !config.redisUrl) throw new Error('BRIDGE_REDIS_URL é obrigatório em produção.');
if (process.env.NODE_ENV === 'production' && !config.encryptionKey) throw new Error('BRIDGE_ENCRYPTION_KEY é obrigatório em produção.');
