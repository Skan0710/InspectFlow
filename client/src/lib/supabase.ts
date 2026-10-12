import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** True when the Supabase project URL and the public anon key are both set. */
export const isAuthConfigured = Boolean(url && anonKey);

// Only the public anon key belongs in the browser; the service-role key stays on the server.
export const supabase: SupabaseClient | null = isAuthConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
