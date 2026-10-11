import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import { getDatabaseConfig } from './config.js';

const { Pool } = pg;

export class DatabaseNotConfiguredError extends Error {
  public readonly missingVariables: string[];

  constructor(missingVariables: string[], message?: string) {
    super(
      message ||
        `Database connection is not configured. Missing environment variable(s): ${missingVariables.join(
          ', '
        )}. Please configure them in server/.env.`
    );
    this.name = 'DatabaseNotConfiguredError';
    this.missingVariables = missingVariables;
  }
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedPgPool: pg.Pool | null = null;

/**
 * Returns an initialized Supabase JS client.
 * Throws DatabaseNotConfiguredError if required credentials are not present.
 */
export function getSupabaseClient(): SupabaseClient {
  const config = getDatabaseConfig();

  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    const missing: string[] = [];
    if (!config.supabaseUrl) missing.push('SUPABASE_URL');
    if (!config.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    throw new DatabaseNotConfiguredError(
      missing,
      `Supabase client unavailable. Missing: ${missing.join(', ')}`
    );
  }

  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createClient(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }

  return cachedSupabaseClient;
}

/**
 * Returns an initialized PostgreSQL connection pool for direct SQL, transactions, or migrations.
 * Throws DatabaseNotConfiguredError if DATABASE_URL / SUPABASE_DB_URL is not provided.
 */
export function getPgPool(): pg.Pool {
  const config = getDatabaseConfig();

  if (!config.databaseUrl) {
    throw new DatabaseNotConfiguredError(
      ['DATABASE_URL'],
      'PostgreSQL pool unavailable. DATABASE_URL is not set in environment.'
    );
  }

  if (!cachedPgPool) {
    const isLocalhost =
      config.databaseUrl.includes('localhost') ||
      config.databaseUrl.includes('127.0.0.1');

    cachedPgPool = new Pool({
      connectionString: config.databaseUrl,
      // Supabase / Cloud Postgres requires SSL, localhost does not
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    cachedPgPool.on('error', (err) => {
      console.error('[PgPool Error] Unexpected idle client error:', err.message);
    });
  }

  return cachedPgPool;
}

/**
 * Safe pagination helper to prevent loading unbounded rows into memory.
 * Uses keyset pagination (or LIMIT/OFFSET) to fetch data in controlled chunks.
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  maxPageSize?: number;
}

export function parsePaginationParams(opts: PaginationOptions = {}) {
  const maxPageSize = opts.maxPageSize || 100;
  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number(opts.pageSize) || 25)
  );
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

/**
 * Gracefully close database connection pools during process termination.
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (cachedPgPool) {
    try {
      await cachedPgPool.end();
      cachedPgPool = null;
    } catch (err: unknown) {
      console.error('[PgPool Close Error]:', err);
    }
  }
  cachedSupabaseClient = null;
}
