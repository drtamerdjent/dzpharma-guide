/**
 * DzPharma Guide — Supabase client (SERVER-ONLY)
 *
 * This module must only be imported from server code (route handlers,
 * server components). Credentials are read from environment variables,
 * so nothing sensitive is ever bundled into client-side JavaScript:
 *
 *   SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY=<your-anon-key>
 *
 * The anon key is safe to use here because row-level security (RLS)
 * remains the source of truth on the database side, and the search
 * endpoint only exposes read-only medication data.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/** True when both Supabase env vars are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a lazily-created, cached Supabase client.
 * Throws a descriptive error when the environment is not configured.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase non configuré : définissez SUPABASE_URL et SUPABASE_ANON_KEY dans le fichier .env"
    );
  }
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

export const MEDICATIONS_TABLE = "medications" as const;
