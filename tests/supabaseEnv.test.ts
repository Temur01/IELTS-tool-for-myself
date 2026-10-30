import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSupabaseEnv, requireSupabaseEnv } from '@/lib/supabase/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stub(url: string, publishable: string, anon: string): void {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', publishable);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', anon);
}

describe('readSupabaseEnv', () => {
  it('prefers the publishable key', () => {
    stub('https://x.supabase.co', 'sb_publishable_new', 'legacy');
    expect(readSupabaseEnv()).toEqual({ url: 'https://x.supabase.co', publishableKey: 'sb_publishable_new' });
  });

  it('falls back to the anon key name', () => {
    stub('https://x.supabase.co', '', 'sb_publishable_old_name');
    expect(readSupabaseEnv()?.publishableKey).toBe('sb_publishable_old_name');
  });

  it('returns null when the url or key is missing', () => {
    stub('', 'sb_publishable_new', '');
    expect(readSupabaseEnv()).toBeNull();
    stub('https://x.supabase.co', '', '');
    expect(readSupabaseEnv()).toBeNull();
  });
});

describe('requireSupabaseEnv', () => {
  it('throws a message naming the missing variables', () => {
    stub('', '', '');
    expect(() => requireSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
