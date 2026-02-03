import fs from 'fs/promises';
import path from 'path';

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage');

export function sanitizePath(input: string) {
  const cleaned = input.replace(/\\/g, '/');
  const segments = cleaned.split('/').filter(Boolean).filter((part) => part !== '..');
  return segments.join('/');
}

export function storageKeyFor(runId: string, filename: string) {
  return path.posix.join('runs', runId, sanitizePath(filename));
}

export function storagePathFor(runId: string, filename: string) {
  return path.join(STORAGE_ROOT, storageKeyFor(runId, filename));
}

export async function ensureStorageDir(filePath: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export { STORAGE_ROOT };
