import { handleFileStream } from '@/lib/wandb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { entity: string; project: string; run: string } }
) {
  return handleFileStream(req, params);
}
