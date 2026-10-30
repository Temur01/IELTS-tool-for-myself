// Single source for Supabase connection settings, shared by the browser client,
// the server client and the proxy. NEXT_PUBLIC_* vars must be referenced literally
// so Next.js can inline them into the client bundle. next.config.mjs also fills
// them from SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY.

export interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

export function readSupabaseEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // PUBLISHABLE_KEY is Supabase's current name; ANON_KEY is accepted for older deployments.
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export const MISSING_ENV_MESSAGE =
  'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.';

export function requireSupabaseEnv(): SupabasePublicEnv {
  const env = readSupabaseEnv();
  if (!env) throw new Error(MISSING_ENV_MESSAGE);
  return env;
}
