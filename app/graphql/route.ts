import { handleGraphql } from '@/lib/wandb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleGraphql(req);
}
