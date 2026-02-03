import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { entity: string; project: string } }
) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') ?? 50);

  const result = await query(
    `SELECT runs.* FROM runs
     JOIN projects ON runs.project_id = projects.id
     JOIN entities ON projects.entity_id = entities.id
     WHERE entities.name = $1 AND projects.name = $2
     ORDER BY runs.started_at DESC
     LIMIT $3`,
    [params.entity, params.project, limit]
  );

  return Response.json({ runs: result.rows });
}
