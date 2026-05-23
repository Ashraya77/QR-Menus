import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const envFiles = [join(process.cwd(), '.env'), join(__dirname, '../../.env')];

for (const filePath of envFiles) {
  if (!existsSync(filePath)) continue;

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');

    process.env[key] ??= value;
  }
}

const requiredEnvKeys = ['DATABASE_URL', 'JWT_ACCESS_SECRET'] as const;

export function getRequiredEnv(key: (typeof requiredEnvKeys)[number]) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

const defaultEnv = {
  JWT_ACCESS_EXPIRES_IN: '15m',
  REFRESH_TOKEN_DAYS: '30',
  FRONTEND_URL: 'http://localhost:3000',
  NODE_ENV: 'development',
} as const;

export function getEnv<K extends keyof typeof defaultEnv>(key: K) {
  return process.env[key] ?? defaultEnv[key];
}

export function validateEnv() {
  for (const key of requiredEnvKeys) {
    getRequiredEnv(key);
  }

  const refreshDays = Number(getEnv('REFRESH_TOKEN_DAYS'));

  if (!Number.isInteger(refreshDays) || refreshDays < 1) {
    throw new Error('REFRESH_TOKEN_DAYS must be a positive integer');
  }

  if (!['development', 'test', 'production'].includes(getEnv('NODE_ENV'))) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  if (
    process.env.COOKIE_DOMAIN !== undefined &&
    process.env.COOKIE_DOMAIN.trim() === ''
  ) {
    throw new Error('COOKIE_DOMAIN cannot be empty when provided');
  }
}
