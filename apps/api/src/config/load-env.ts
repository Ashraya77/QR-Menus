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
