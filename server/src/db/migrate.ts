import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDatabaseConfig } from './config.js';
import { getPgPool, closeDatabaseConnections } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<{ success: boolean; message: string }> {
  const config = getDatabaseConfig();

  if (!config.databaseUrl) {
    const message =
      'Cannot run migrations: DATABASE_URL (or SUPABASE_DB_URL) is not set. Please configure your Supabase PostgreSQL connection string in server/.env.';
    console.error(`❌ ${message}`);
    return { success: false, message };
  }

  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    const message = `Migrations directory not found at: ${migrationsDir}`;
    console.error(`❌ ${message}`);
    return { success: false, message };
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    const message = `No SQL migration files found in: ${migrationsDir}`;
    console.error(`❌ ${message}`);
    return { success: false, message };
  }

  console.log(`🔄 Connecting to PostgreSQL database to execute ${migrationFiles.length} migrations...`);
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    for (const file of migrationFiles) {
      console.log(`⚡ Executing ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }
    await client.query('COMMIT');

    const successMessage = `✅ Successfully executed all ${migrationFiles.length} schema migrations (${migrationFiles.join(', ')}).`;
    console.log(successMessage);
    return { success: true, message: successMessage };
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Migration failed and rolled back:', errMessage);
    return {
      success: false,
      message: `Migration failed: ${errMessage}`,
    };
  } finally {
    client.release();
    await closeDatabaseConnections();
  }
}

// Allow direct CLI invocation: tsx src/db/migrate.ts
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
