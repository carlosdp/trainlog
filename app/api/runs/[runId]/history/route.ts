import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function downsample<T>(rows: T[], max = 2000) {
  if (rows.length <= max) return rows;
  const stride = Math.ceil(rows.length / max);
  return rows.filter((_, index) => index % stride === 0);
}

export async function GET(
  req: Request,
  { params }: { params: { runId: string } }
) {
  const { searchParams } = new URL(req.url);
  const keys = (searchParams.get('keys') ?? '').split(',').filter(Boolean);
  const minStep = searchParams.get('minStep');
  const maxStep = searchParams.get('maxStep');

  const result = await query(
    `SELECT run_history.step, run_history.ts, run_history.data
     FROM run_history
     JOIN runs ON run_history.run_pk = runs.id
     WHERE runs.run_id = $1
       AND ($2::int IS NULL OR run_history.step >= $2)
       AND ($3::int IS NULL OR run_history.step <= $3)
     ORDER BY run_history.step ASC`,
    [params.runId, minStep ? Number(minStep) : null, maxStep ? Number(maxStep) : null]
  );

  const rows = downsample(result.rows as Array<{ step: number; ts: string; data: Record<string, unknown> }>);
  const points = rows.map((row) => {
    const payload: Record<string, unknown> = { step: row.step, ts: row.ts };
    if (keys.length === 0) {
      Object.assign(payload, row.data);
    } else {
      for (const key of keys) {
        payload[key] = row.data[key];
      }
    }
    return payload;
  });

  return Response.json({ points });
}
