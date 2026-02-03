import crypto from 'crypto';
import { query } from './db';

export type ApiKeyRecord = {
  id: string;
  key_hash: string;
  name: string | null;
};

export function extractApiKey(req: Request) {
  const header = req.headers.get('authorization');
  const direct = req.headers.get('x-wandb-api-key');
  if (direct) {
    return direct.trim();
  }
  if (!header) {
    return null;
  }
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  if (header.toLowerCase().startsWith('basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf-8');
    const [key] = decoded.split(':');
    return key || null;
  }
  return null;
}

export function hashApiKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function ensureApiKey(key: string) {
  const hash = hashApiKey(key);
  const result = await query<ApiKeyRecord>(
    `INSERT INTO api_keys (key_hash, name, created_at, last_used_at)
     VALUES ($1, NULL, now(), now())
     ON CONFLICT (key_hash) DO UPDATE SET last_used_at = now()
     RETURNING id, key_hash, name`,
    [hash]
  );
  return result.rows[0];
}
