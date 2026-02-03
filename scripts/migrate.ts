import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString });
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    if (!sql.trim()) continue;
    await pool.query(sql);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
