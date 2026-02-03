import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const params = await context.params;
  const result = await query(
    `SELECT runs.*, projects.name as project_name, entities.name as entity_name
     FROM runs
     JOIN projects ON runs.project_id = projects.id
     JOIN entities ON projects.entity_id = entities.id
     WHERE runs.run_id = $1
     LIMIT 1`,
    [params.runId]
  );

  return Response.json({ run: result.rows[0] ?? null });
}
