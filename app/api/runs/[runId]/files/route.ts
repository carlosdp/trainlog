import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  const params = await context.params;
  const result = await query(
    `SELECT run_files.*
     FROM run_files
     JOIN runs ON run_files.run_pk = runs.id
     WHERE runs.run_id = $1
     ORDER BY run_files.updated_at DESC`,
    [params.runId]
  );

  return Response.json({ files: result.rows });
}
