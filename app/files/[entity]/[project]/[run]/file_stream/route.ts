import { handleFileStream } from '@/lib/wandb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ entity: string; project: string; run: string }> }
) {
  const params = await context.params;
  return handleFileStream(req, params);
}
