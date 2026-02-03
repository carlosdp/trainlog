import Link from 'next/link';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function EntityPage({ params }: { params: { entity: string } }) {
  const result = await query(
    `SELECT projects.name as project,
            COUNT(runs.id)::int as run_count,
            MAX(runs.started_at) as last_started
     FROM projects
     JOIN entities ON projects.entity_id = entities.id
     LEFT JOIN runs ON runs.project_id = projects.id
     WHERE entities.name = $1
     GROUP BY projects.name
     ORDER BY projects.name`,
    [params.entity]
  );

  const projects = result.rows as Array<{
    project: string;
    run_count: number;
    last_started: string | null;
  }>;

  return (
    <>
      <header>
        <div className="brand">
          <h1>{params.entity}</h1>
          <p>Projects tracked for this entity.</p>
        </div>
        <Link className="chip" href="/">
          All entities
        </Link>
      </header>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Runs</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.project}>
                <td>
                  <Link href={`/e/${params.entity}/${project.project}`}>{project.project}</Link>
                </td>
                <td>{project.run_count}</td>
                <td>{project.last_started ? new Date(project.last_started).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
