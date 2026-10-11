import dotenv from 'dotenv';

dotenv.config();

export interface DatabaseConfig {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  databaseUrl?: string;
  isConfigured: boolean;
  missingVariables: string[];
}

export function getDatabaseConfig(): DatabaseConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim();
  const databaseUrl = (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL
  )?.trim();

  const missingVariables: string[] = [];

  // A valid Supabase setup requires either:
  // 1. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (for Supabase PostgREST Client)
  // 2. DATABASE_URL / SUPABASE_DB_URL (for Direct Postgres Pool)
  // Ideally both for full capabilities.
  if (!supabaseUrl) {
    missingVariables.push('SUPABASE_URL');
  }
  if (!supabaseServiceKey) {
    missingVariables.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (!databaseUrl) {
    missingVariables.push('DATABASE_URL');
  }

  // Considered configured if at least one operational pathway is provided
  const isConfigured = Boolean(
    (supabaseUrl && supabaseServiceKey) || databaseUrl
  );

  return {
    supabaseUrl,
    supabaseServiceKey,
    databaseUrl,
    isConfigured,
    missingVariables,
  };
}
