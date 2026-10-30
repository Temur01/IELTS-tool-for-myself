'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseEnv } from './env';

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, publishableKey } = requireSupabaseEnv();
    client = createBrowserClient(url, publishableKey);
  }
  return client;
}
