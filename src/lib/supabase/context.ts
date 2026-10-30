import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseEnv, UserClaims } from '@supabase/server';
import { createContextClient, verifyCredentials } from '@supabase/server/core';
import { getServerSupabase } from './server';
import { requireSupabaseEnv } from './env';

export interface VerifiedContext {
  /** RLS-scoped client bound to the verified user's access token. */
  supabase: SupabaseClient;
  userClaims: UserClaims;
}

export type VerifiedContextResult =
  | { data: VerifiedContext; error: null }
  | { data: null; error: Error };

/**
 * Reads the session cookie (refreshed by the proxy) through @supabase/ssr, then
 * verifies the access token with @supabase/server against the project's JWKS.
 * Verification is local after the first key fetch, so unlike auth.getUser()
 * it costs no Auth-server round-trip per request.
 */
export async function getVerifiedContext(): Promise<VerifiedContextResult> {
  const { url, publishableKey } = requireSupabaseEnv();
  const env: Partial<SupabaseEnv> = {
    url,
    publishableKeys: { default: publishableKey },
    secretKeys: {},
    // A URL lets jose fetch and cache the signing keys itself.
    jwks: new URL(process.env.SUPABASE_JWKS_URL || '/auth/v1/.well-known/jwks.json', url),
  };

  const ssr = await getServerSupabase();
  const { data: { session } } = await ssr.auth.getSession();
  const token = session?.access_token ?? null;

  const { data: auth, error } = await verifyCredentials({ token, apikey: null }, { auth: 'user', env });
  if (error) return { data: null, error };
  if (!auth.token || !auth.userClaims) {
    return { data: null, error: new Error('Verified session has no user token.') };
  }

  const supabase = createContextClient({ auth: { token: auth.token }, env });
  return { data: { supabase, userClaims: auth.userClaims }, error: null };
}
