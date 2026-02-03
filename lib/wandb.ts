import crypto from 'crypto';
import { extractApiKey, ensureApiKey } from './auth';
import {
  upsertRun,
  findRunByProject,
  findRunByRunId,
  updateRunSummary,
  updateRunConfig,
  markRunComplete,
  upsertRunHistory,
  updateFileCursor,
  upsertRunFile
} from './models';
import { query } from './db';
import { storageKeyFor } from './storage';

const DEFAULT_ENTITY = 'default';
const DEFAULT_PROJECT = 'uncategorized';

function inferOperationName(queryText: string) {
  const match = queryText.match(/(mutation|query)\s+(\w+)/);
  return match?.[2] ?? null;
}

function getBaseUrl(req: Request) {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

function normalizeFilesPayload(files: Record<string, unknown>) {
  const entries: Array<{ filename: string; offset: number; content: string[] }> = [];
  for (const [filename, value] of Object.entries(files)) {
    if (Array.isArray(value)) {
      for (const chunk of value) {
        if (chunk && typeof chunk === 'object') {
          const record = chunk as { offset?: number; content?: string[] };
          entries.push({
            filename,
            offset: record.offset ?? 0,
            content: record.content ?? []
          });
        }
      }
    } else if (value && typeof value === 'object') {
      const record = value as { offset?: number; content?: string[] };
      entries.push({
        filename,
        offset: record.offset ?? 0,
        content: record.content ?? []
      });
    }
  }
  return entries;
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function randomRunId() {
  return crypto.randomBytes(5).toString('hex');
}

async function recordUnknownOp(apiKeyId: string | null, queryText: string, variables: unknown) {
  const hash = crypto.createHash('sha256').update(queryText).digest('hex');
  await query(
    `INSERT INTO graphql_unknown_ops (seen_at, api_key_id, query, variables, query_hash)
     VALUES (now(), $1, $2, $3::jsonb, $4)`,
    [apiKeyId, queryText, JSON.stringify(variables ?? {}), hash]
  );
}

function pickFirst(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value) return value;
  }
  return null;
}

export async function handleGraphql(req: Request) {
  const body = await req.json();
  const queryText = body.query ?? '';
  const variables = body.variables ?? {};
  const operationName = body.operationName ?? inferOperationName(queryText);

  const apiKey = extractApiKey(req);
  const apiKeyRecord = apiKey ? await ensureApiKey(apiKey) : null;

  if (queryText.includes('ProbeServerCapabilities') || operationName === 'ProbeServerCapabilities') {
    return Response.json({
      data: {
        probeServerCapabilities: {
          recallTags: false,
          useArtifact: false,
          heartbeat: true,
          storage: true,
          directSync: true,
          history: true,
          gitOps: false
        }
      }
    });
  }

  if (queryText.includes('Viewer') || operationName === 'Viewer') {
    return Response.json({
      data: {
        viewer: {
          id: apiKeyRecord?.id ?? 'viewer',
          username: 'trainlog',
          email: 'trainlog@local',
          entity: {
            id: apiKeyRecord?.id ?? 'entity',
            name: DEFAULT_ENTITY
          }
        }
      }
    });
  }

  if (queryText.includes('UpsertBucket') || operationName === 'UpsertBucket') {
    const input = variables.input ?? variables;
    const entity = pickFirst(input.entityName, input.entity, variables.entityName, variables.entity, DEFAULT_ENTITY) ?? DEFAULT_ENTITY;
    const project = pickFirst(input.projectName, input.project, variables.projectName, variables.project, DEFAULT_PROJECT) ?? DEFAULT_PROJECT;
    const runId = pickFirst(input.name, input.runName, input.id, variables.name, variables.runName, variables.id) ?? randomRunId();
    const displayName = pickFirst(input.displayName, variables.displayName, runId);

    const run = await upsertRun({
      entity,
      project,
      runId,
      displayName,
      host: input.host ?? null,
      program: input.program ?? null,
      tags: input.tags ?? null,
      notes: input.notes ?? null,
      gitRemote: input.git?.remote ?? input.gitRemote ?? null,
      gitCommit: input.git?.commit ?? input.gitCommit ?? null
    });

    return Response.json({
      data: {
        upsertBucket: {
          bucket: {
            id: run.storage_id,
            name: run.run_id,
            displayName: run.display_name ?? run.run_id,
            project: {
              name: project,
              entity: {
                name: entity
              }
            }
          },
          inserted: true
        }
      }
    });
  }

  if (
    queryText.includes('CreateRunFiles') ||
    queryText.includes('PrepareFiles') ||
    operationName === 'CreateRunFiles' ||
    operationName === 'PrepareFiles'
  ) {
    const input = variables.input ?? variables;
    const entity = pickFirst(input.entityName, input.entity, variables.entityName, variables.entity, DEFAULT_ENTITY) ?? DEFAULT_ENTITY;
    const project = pickFirst(input.projectName, input.project, variables.projectName, variables.project, DEFAULT_PROJECT) ?? DEFAULT_PROJECT;
    const runId = pickFirst(input.runName, input.name, input.id, variables.runName, variables.name, variables.id) ?? '';
    const files = input.files ?? input.paths ?? input.fileNames ?? variables.files ?? variables.paths ?? [];

    const run = runId ? await findRunByProject(entity, project, runId) : null;
    const resolvedRun = run ?? (runId ? await findRunByRunId(runId) : null);

    const baseUrl = getBaseUrl(req);
    const responseFiles = (Array.isArray(files) ? files : []).map((file: any) => {
      const name = typeof file === 'string' ? file : file.name;
      const url = new URL('/storage', baseUrl);
      if (resolvedRun) {
        url.searchParams.set('run', resolvedRun.run_id);
      }
      url.searchParams.set('file', name);
      if (resolvedRun) {
        void upsertRunFile(resolvedRun.id, name, {
          storageKey: storageKeyFor(resolvedRun.run_id, name),
          size: file.size ?? null,
          digest: file.md5 ?? file.digest ?? null,
          contentType: file.contentType ?? null
        });
      }
      return {
        name,
        uploadUrl: url.toString(),
        url: url.toString(),
        directUrl: url.toString()
      };
    });

    return Response.json({
      data: {
        createRunFiles: {
          files: responseFiles,
          edges: responseFiles.map((file) => ({ node: file }))
        },
        prepareFiles: {
          files: responseFiles,
          edges: responseFiles.map((file) => ({ node: file }))
        }
      }
    });
  }

  if (queryText.includes('upsertRun') || queryText.includes('UpdateRun') || operationName === 'UpsertRun') {
    const input = variables.input ?? variables;
    const runId = pickFirst(input.name, input.runName, variables.name, variables.runName, variables.id);
    let run = runId ? await findRunByRunId(runId) : null;

    if (!run) {
      const entity = pickFirst(input.entityName, input.entity, variables.entityName, variables.entity, DEFAULT_ENTITY) ?? DEFAULT_ENTITY;
      const project = pickFirst(input.projectName, input.project, variables.projectName, variables.project, DEFAULT_PROJECT) ?? DEFAULT_PROJECT;
      const created = await upsertRun({
        entity,
        project,
        runId: runId ?? randomRunId(),
        displayName: input.displayName ?? null
      });
      run = created;
    }

    if (input.summary) {
      await updateRunSummary(run.id, input.summary);
    }
    if (input.config) {
      await updateRunConfig(run.id, input.config);
    }

    return Response.json({
      data: {
        upsertRun: {
          run: {
            id: run.storage_id,
            name: run.run_id
          }
        }
      }
    });
  }

  await recordUnknownOp(apiKeyRecord?.id ?? null, queryText, variables);

  return Response.json({
    errors: [
      {
        message: 'NOT_IMPLEMENTED',
        extensions: { code: 'NOT_IMPLEMENTED' }
      }
    ]
  });
}

export async function handleFileStream(req: Request, params: { entity: string; project: string; run: string }) {
  const apiKey = extractApiKey(req);
  if (apiKey) {
    await ensureApiKey(apiKey);
  }

  const payload = await req.json();
  const run = await findRunByProject(params.entity, params.project, params.run);
  const resolvedRun =
    run ??
    (await upsertRun({
      entity: params.entity,
      project: params.project,
      runId: params.run
    }));

  if (payload.files) {
    const entries = normalizeFilesPayload(payload.files);
    let stepCursor = 0;
    for (const entry of entries) {
      if (entry.filename === 'wandb-history.jsonl') {
        let lastStep = stepCursor;
        let lineCount = 0;
        for (const line of entry.content) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parsed = safeJsonParse(trimmed);
          if (!parsed) continue;
          const step = typeof parsed._step === 'number' ? parsed._step : lastStep + 1;
          lastStep = step;
          const timestampSeconds = typeof parsed._timestamp === 'number' ? parsed._timestamp : Date.now() / 1000;
          const ts = new Date(timestampSeconds * 1000);
          await upsertRunHistory(resolvedRun.id, step, ts, parsed);
          lineCount += 1;
        }
        stepCursor = lastStep;
        await updateFileCursor(resolvedRun.id, entry.filename, entry.offset + lineCount, lineCount);
      } else if (entry.filename === 'wandb-summary.json') {
        const content = entry.content.join('');
        const parsed = safeJsonParse(content);
        if (parsed) {
          await updateRunSummary(resolvedRun.id, parsed);
        }
        await updateFileCursor(resolvedRun.id, entry.filename, entry.offset + 1, 1);
      } else if (entry.filename === 'config.yaml' || entry.filename === 'config.json') {
        const content = entry.content.join('');
        const parsed = safeJsonParse(content) ?? { raw: content };
        await updateRunConfig(resolvedRun.id, parsed);
        await updateFileCursor(resolvedRun.id, entry.filename, entry.offset + 1, 1);
      } else {
        if (entry.content.length > 0) {
          await updateFileCursor(resolvedRun.id, entry.filename, entry.offset + entry.content.length, entry.content.length);
        }
      }
    }
  }

  if (Array.isArray(payload.uploaded)) {
    for (const name of payload.uploaded) {
      await upsertRunFile(resolvedRun.id, name, { storageKey: storageKeyFor(resolvedRun.run_id, name) });
    }
  }

  if (payload.complete) {
    await markRunComplete(resolvedRun.id, typeof payload.exitcode === 'number' ? payload.exitcode : null);
  }

  return Response.json({
    exitcode: null,
    limits: {}
  });
}
