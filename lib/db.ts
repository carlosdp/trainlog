import { Pool, PoolClient, QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export type DbQuery = typeof pool.query;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  const result = await pool.query<T>(text, params);
  return result;
}

export async function withClient<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function ensureDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }
}
