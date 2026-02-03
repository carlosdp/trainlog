import crypto from 'crypto';
import { query } from './db';

export type RunRecord = {
  id: string;
  run_id: string;
  storage_id: string;
  display_name: string | null;
  state: string;
  started_at: string;
  finished_at: string | null;
  summary_json: unknown | null;
  config_json: unknown | null;
  project_id: string;
  entity_id: string;
};

export async function ensureEntity(name: string) {
  const result = await query<{ id: string }>(
    `INSERT INTO entities (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return result.rows[0].id;
}

export async function ensureProject(entityId: string, name: string) {
  const result = await query<{ id: string }>(
    `INSERT INTO projects (entity_id, name)
     VALUES ($1, $2)
     ON CONFLICT (entity_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [entityId, name]
  );
  return result.rows[0].id;
}

export async function upsertRun(params: {
  entity: string;
  project: string;
  runId: string;
  displayName?: string | null;
  host?: string | null;
  program?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  gitRemote?: string | null;
  gitCommit?: string | null;
}) {
  const entityId = await ensureEntity(params.entity);
  const projectId = await ensureProject(entityId, params.project);
  const storageId = crypto.randomUUID();
  const result = await query<RunRecord>(
    `INSERT INTO runs (
        run_id,
        storage_id,
        entity_id,
        project_id,
        display_name,
        state,
        started_at,
        host,
        program,
        tags,
        notes,
        git_remote,
        git_commit,
        created_at,
        updated_at
      )
     VALUES ($1, $2, $3, $4, $5, 'running', now(), $6, $7, $8, $9, $10, $11, now(), now())
     ON CONFLICT (project_id, run_id)
     DO UPDATE SET
        state = 'running',
        display_name = COALESCE(EXCLUDED.display_name, runs.display_name),
        host = COALESCE(EXCLUDED.host, runs.host),
        program = COALESCE(EXCLUDED.program, runs.program),
        tags = COALESCE(EXCLUDED.tags, runs.tags),
        notes = COALESCE(EXCLUDED.notes, runs.notes),
        git_remote = COALESCE(EXCLUDED.git_remote, runs.git_remote),
        git_commit = COALESCE(EXCLUDED.git_commit, runs.git_commit),
        updated_at = now()
     RETURNING *`,
    [
      params.runId,
      storageId,
      entityId,
      projectId,
      params.displayName ?? null,
      params.host ?? null,
      params.program ?? null,
      params.tags ?? null,
      params.notes ?? null,
      params.gitRemote ?? null,
      params.gitCommit ?? null
    ]
  );
  return result.rows[0];
}

export async function findRunByRunId(runId: string) {
  const result = await query<RunRecord>(
    `SELECT * FROM runs WHERE run_id = $1`,
    [runId]
  );
  return result.rows[0] ?? null;
}

export async function findRunByProject(entity: string, project: string, runId: string) {
  const result = await query<RunRecord>(
    `SELECT runs.* FROM runs
     JOIN projects ON runs.project_id = projects.id
     JOIN entities ON projects.entity_id = entities.id
     WHERE entities.name = $1 AND projects.name = $2 AND runs.run_id = $3`,
    [entity, project, runId]
  );
  return result.rows[0] ?? null;
}

export async function updateRunSummary(runPk: string, summary: unknown) {
  await query(
    `UPDATE runs SET summary_json = $2::jsonb, updated_at = now() WHERE id = $1`,
    [runPk, JSON.stringify(summary)]
  );
}

export async function updateRunConfig(runPk: string, config: unknown) {
  await query(
    `UPDATE runs SET config_json = $2::jsonb, updated_at = now() WHERE id = $1`,
    [runPk, JSON.stringify(config)]
  );
}

export async function markRunComplete(runPk: string, exitCode: number | null) {
  const state = exitCode === null || exitCode === 0 ? 'finished' : 'failed';
  await query(
    `UPDATE runs SET state = $2, finished_at = now(), updated_at = now() WHERE id = $1`,
    [runPk, state]
  );
}

export async function upsertRunHistory(runPk: string, step: number, ts: Date, data: unknown) {
  await query(
    `INSERT INTO run_history (run_pk, step, ts, data)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (run_pk, step) DO UPDATE
     SET data = run_history.data || EXCLUDED.data,
         ts = EXCLUDED.ts`,
    [runPk, step, ts.toISOString(), JSON.stringify(data)]
  );
}

export async function updateFileCursor(runPk: string, filename: string, lastOffset: number, lineCount: number) {
  await query(
    `INSERT INTO filestream_cursors (run_pk, filename, last_offset, line_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (run_pk, filename)
     DO UPDATE SET
       last_offset = GREATEST(filestream_cursors.last_offset, EXCLUDED.last_offset),
       line_count = filestream_cursors.line_count + EXCLUDED.line_count`,
    [runPk, filename, lastOffset, lineCount]
  );
}

export async function upsertRunFile(runPk: string, name: string, params: {
  storageKey?: string | null;
  size?: number | null;
  digest?: string | null;
  contentType?: string | null;
}) {
  await query(
    `INSERT INTO run_files (run_pk, name, storage_key, size, digest, content_type, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())
     ON CONFLICT (run_pk, name)
     DO UPDATE SET
       storage_key = COALESCE(EXCLUDED.storage_key, run_files.storage_key),
       size = COALESCE(EXCLUDED.size, run_files.size),
       digest = COALESCE(EXCLUDED.digest, run_files.digest),
       content_type = COALESCE(EXCLUDED.content_type, run_files.content_type),
       updated_at = now()`,
    [
      runPk,
      name,
      params.storageKey ?? null,
      params.size ?? null,
      params.digest ?? null,
      params.contentType ?? null
    ]
  );
}
