import Link from 'next/link';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const result = await query(
    `SELECT entities.name as entity,
            projects.name as project,
            COUNT(runs.id)::int as run_count,
            MAX(runs.started_at) as last_started
     FROM projects
     JOIN entities ON projects.entity_id = entities.id
     LEFT JOIN runs ON runs.project_id = projects.id
     GROUP BY entities.name, projects.name
     ORDER BY entities.name, projects.name`
  );

  const projects = result.rows as Array<{
    entity: string;
    project: string;
    run_count: number;
    last_started: string | null;
  }>;

  return (
    <>
      <header>
        <div className="brand">
          <h1>Trainlog</h1>
          <p>W&B-compatible run tracking, tuned for fast iteration.</p>
        </div>
        <span className="chip">/graphql · /files · /storage</span>
      </header>

      <section className="grid cols-2">
        <div className="panel">
          <h2>Projects</h2>
          {projects.length === 0 ? (
            <p className="notice">No runs yet. Point the W&B SDK at this host to begin logging.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Project</th>
                  <th>Runs</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={`${project.entity}-${project.project}`}>
                    <td>
                      <Link href={`/e/${project.entity}`}>{project.entity}</Link>
                    </td>
                    <td>
                      <Link href={`/e/${project.entity}/${project.project}`}>{project.project}</Link>
                    </td>
                    <td>{project.run_count}</td>
                    <td>{project.last_started ? new Date(project.last_started).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="panel">
          <h2>Connect a run</h2>
          <p className="notice">
            Set <strong>WANDB_BASE_URL</strong> to this host, plus <strong>WANDB_API_KEY</strong>, then log metrics
            as usual.
          </p>
          <pre className="panel" style={{ marginTop: 16, background: 'var(--panel-alt)' }}>
            {`export WANDB_BASE_URL="http://your-host:8080"\nexport WANDB_API_KEY="your-key"`}
          </pre>
        </div>
      </section>
    </>
  );
}
