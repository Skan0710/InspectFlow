import { getDatabaseConfig } from './config.js';
import { getPgPool, getSupabaseClient } from './client.js';

export interface DatabaseHealthReport {
  configured: boolean;
  status: 'connected' | 'unconfigured' | 'unreachable';
  reachable: boolean;
  latencyMs?: number;
  provider?: string;
  database?: string;
  timestamp: string;
  missingVariables?: string[];
  message: string;
  error?: string;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthReport> {
  const config = getDatabaseConfig();
  const timestamp = new Date().toISOString();

  // If no credentials provided, return cleanly without attempting network calls
  if (!config.isConfigured) {
    return {
      configured: false,
      status: 'unconfigured',
      reachable: false,
      timestamp,
      missingVariables: config.missingVariables,
      message:
        'Database is not configured. Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or DATABASE_URL).',
    };
  }

  const startTime = performance.now();

  // Prefer direct Postgres Pool verification if DATABASE_URL is present
  if (config.databaseUrl) {
    try {
      const pool = getPgPool();
      const res = await pool.query(
        'SELECT NOW() as current_time, current_database() as db_name, version() as version'
      );
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        configured: true,
        status: 'connected',
        reachable: true,
        latencyMs,
        provider: 'Supabase PostgreSQL (Direct Pool)',
        database: res.rows[0]?.db_name,
        timestamp,
        message: 'Successfully connected and verified PostgreSQL database.',
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown database connection error';

      return {
        configured: true,
        status: 'unreachable',
        reachable: false,
        latencyMs,
        provider: 'Supabase PostgreSQL (Direct Pool)',
        timestamp,
        message: 'Database is configured but currently unreachable.',
        error: errorMessage,
      };
    }
  }

  // Fallback to Supabase PostgREST client check
  if (config.supabaseUrl && config.supabaseServiceKey) {
    try {
      const supabase = getSupabaseClient();
      // Simple lightweight query to check connectivity
      const { error } = await supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true });

      const latencyMs = Math.round(performance.now() - startTime);

      // If relation does not exist yet (code 42P01 in postgres or PGRST204), the API is still reachable!
      const isReachable = !error || error.code === '42P01' || error.code === 'PGRST204' || error.code === 'PGRST200';

      if (!isReachable) {
        throw new Error(error.message);
      }

      return {
        configured: true,
        status: 'connected',
        reachable: true,
        latencyMs,
        provider: 'Supabase PostgREST Client',
        timestamp,
        message: 'Successfully reached Supabase API endpoint.',
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to reach Supabase API';

      return {
        configured: true,
        status: 'unreachable',
        reachable: false,
        latencyMs,
        provider: 'Supabase PostgREST Client',
        timestamp,
        message: 'Supabase endpoint configured but failed connection test.',
        error: errorMessage,
      };
    }
  }

  return {
    configured: false,
    status: 'unconfigured',
    reachable: false,
    timestamp,
    missingVariables: config.missingVariables,
    message: 'Database configuration missing.',
  };
}
