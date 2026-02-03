import Link from 'next/link';
import { query } from '@/lib/db';
import { StateBadge } from '@/components/StateBadge';
import { HistoryChart } from '@/components/HistoryChart';
import { basePath } from '@/lib/basePath';

export const dynamic = 'force-dynamic';

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default async function RunDetail({ params }: { params: { runId: string } }) {
  const runResult = await query(
    `SELECT runs.*, projects.name as project_name, entities.name as entity_name
     FROM runs
     JOIN projects ON runs.project_id = projects.id
     JOIN entities ON projects.entity_id = entities.id
     WHERE runs.run_id = $1
     LIMIT 1`,
    [params.runId]
  );
  type RunRow = {
    id: string;
    run_id: string;
    display_name: string | null;
    state: string;
    started_at: string;
    finished_at: string | null;
    summary_json: Record<string, unknown> | null;
    config_json: Record<string, unknown> | null;
    project_name: string;
    entity_name: string;
  };
  const run = runResult.rows[0] as RunRow | undefined;

  if (!run) {
    return (
      <>
        <header>
          <div className="brand">
            <h1>Run not found</h1>
            <p>We could not locate that run.</p>
          </div>
          <Link className="chip" href="/">
            Back home
          </Link>
        </header>
      </>
    );
  }

  const historyResult = await query(
    `SELECT data FROM run_history
     WHERE run_pk = $1
     ORDER BY step DESC
     LIMIT 200`,
    [run.id]
  );

  const metricKeys = new Set<string>();
  for (const row of historyResult.rows as Array<{ data: Record<string, unknown> }>) {
    for (const [key, value] of Object.entries(row.data ?? {})) {
      if (key.startsWith('_')) continue;
      if (typeof value === 'number') {
        metricKeys.add(key);
      }
    }
  }

  const filesResult = await query(
    `SELECT name, size, updated_at
     FROM run_files
     WHERE run_pk = $1
     ORDER BY updated_at DESC
     LIMIT 50`,
    [run.id]
  );

  const files = filesResult.rows as Array<{ name: string; size: number | null; updated_at: string }>;

  return (
    <>
      <header>
        <div className="brand">
          <h1>{run.display_name ?? run.run_id}</h1>
          <p>
            {run.entity_name} / {run.project_name}
          </p>
        </div>
        <Link className="chip" href={`/e/${run.entity_name}/${run.project_name}`}>
          Back to project
        </Link>
      </header>

      <section className="grid cols-2">
        <div className="panel">
          <h2>Run summary</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
            <div className="kpi">
              <span>Status</span>
              <StateBadge state={run.state} />
            </div>
            <div className="kpi">
              <span>Started</span>
              <strong>{new Date(run.started_at).toLocaleString()}</strong>
            </div>
            <div className="kpi">
              <span>Finished</span>
              <strong>{run.finished_at ? new Date(run.finished_at).toLocaleString() : '—'}</strong>
            </div>
          </div>
          <pre className="panel" style={{ marginTop: 16, background: 'var(--panel-alt)', maxHeight: 260, overflow: 'auto' }}>
            {formatJson(run.summary_json)}
          </pre>
        </div>
        <div className="panel">
          <h2>Config</h2>
          <pre className="panel" style={{ background: 'var(--panel-alt)', maxHeight: 320, overflow: 'auto' }}>
            {formatJson(run.config_json)}
          </pre>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <HistoryChart runId={run.run_id} metricKeys={[...metricKeys]} />
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <h2>Files</h2>
        {files.length === 0 ? (
          <p className="notice">No files uploaded yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.name}>
                  <td>
                    <a
                      href={`${basePath}/storage?run=${encodeURIComponent(run.run_id)}&file=${encodeURIComponent(
                        file.name
                      )}`}
                    >
                      {file.name}
                    </a>
                  </td>
                  <td>{file.size ? `${(file.size / 1024).toFixed(1)} KB` : '—'}</td>
                  <td>{new Date(file.updated_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
