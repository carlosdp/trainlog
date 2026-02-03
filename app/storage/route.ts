import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { findRunByRunId, upsertRunFile } from '@/lib/models';
import { ensureStorageDir, storagePathFor, storageKeyFor } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('run');
  const file = searchParams.get('file');

  if (!runId || !file) {
    return badRequest('run and file are required');
  }

  if (!req.body) {
    return badRequest('missing request body');
  }

  const filePath = storagePathFor(runId, file);
  await ensureStorageDir(filePath);

  let size = 0;
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      callback(null, chunk);
    }
  });

  const bodyStream = req.body as unknown as WebReadableStream<Uint8Array>;
  await pipeline(Readable.fromWeb(bodyStream), counter, fs.createWriteStream(filePath));

  const run = await findRunByRunId(runId);
  if (run) {
    await upsertRunFile(run.id, file, {
      storageKey: storageKeyFor(runId, file),
      size,
      contentType: req.headers.get('content-type')
    });
  }

  return new Response(JSON.stringify({ ok: true, size }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get('run');
  const file = searchParams.get('file');

  if (!runId || !file) {
    return badRequest('run and file are required');
  }

  const filePath = storagePathFor(runId, file);
  if (!fs.existsSync(filePath)) {
    return badRequest('file not found', 404);
  }

  const stream = fs.createReadStream(filePath);
  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      'content-type': 'application/octet-stream'
    }
  });
}
