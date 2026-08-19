import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

const key = () => {
  if (!config.encryptionKey) throw new Error('BRIDGE_ENCRYPTION_KEY é obrigatório para guardar credenciais fora do ambiente local.');
  return createHash('sha256').update(config.encryptionKey).digest();
};

export const encryptBridgeValue = (value: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};

export const decryptBridgeValue = (value: string) => {
  const [version, encodedIv, encodedTag, encodedValue] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedTag || !encodedValue) throw new Error('Valor criptografado inválido.');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encodedValue, 'base64url')), decipher.final()]).toString('utf8');
};
