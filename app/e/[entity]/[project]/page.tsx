import Link from 'next/link';
import { query } from '@/lib/db';
import { StateBadge } from '@/components/StateBadge';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({
  params
}: {
  params: { entity: string; project: string };
}) {
  const result = await query(
    `SELECT runs.*
     FROM runs
     JOIN projects ON runs.project_id = projects.id
     JOIN entities ON projects.entity_id = entities.id
     WHERE entities.name = $1 AND projects.name = $2
     ORDER BY runs.started_at DESC
     LIMIT 100`,
    [params.entity, params.project]
  );

  const runs = result.rows as Array<{
    run_id: string;
    display_name: string | null;
    state: string;
    started_at: string;
    finished_at: string | null;
    summary_json: Record<string, unknown> | null;
  }>;

  return (
    <>
      <header>
        <div className="brand">
          <h1>
            {params.entity} / {params.project}
          </h1>
          <p>Latest runs in this project.</p>
        </div>
        <Link className="chip" href={`/e/${params.entity}`}>
          Back to entity
        </Link>
      </header>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const started = new Date(run.started_at);
              const finished = run.finished_at ? new Date(run.finished_at) : null;
              const duration = finished
                ? `${Math.round((finished.getTime() - started.getTime()) / 1000)}s`
                : 'running';
              const summary = run.summary_json ?? {};
              const highlight = Object.entries(summary)
                .slice(0, 2)
                .map(([key, value]) => `${key}: ${value}`)
                .join(' · ');
              return (
                <tr key={run.run_id}>
                  <td>
                    <Link href={`/runs/${run.run_id}`}>{run.display_name ?? run.run_id}</Link>
                  </td>
                  <td>
                    <StateBadge state={run.state} />
                  </td>
                  <td>{started.toLocaleString()}</td>
                  <td>{duration}</td>
                  <td>{highlight || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
