import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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

  return Response.json({ projects: result.rows });
}
