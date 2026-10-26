import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { cleanTerm, lookupAll } from '@/lib/dictionary';

// GET /api/lookup?term=mitigate&lc=to&rc=the&fresh=1
// Only the term and its two neighbouring words reach the providers.
export async function GET(request) {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return NextResponse.json({ error: 'Sign in to look up words.' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const term = cleanTerm(params.get('term'));
  if (!term) {
    return NextResponse.json(
      { error: 'Enter a word or short phrase (letters, spaces, hyphens, apostrophes; max 60 characters).' },
      { status: 400 },
    );
  }

  const fresh = params.get('fresh') === '1';
  const result = await lookupAll(term, { fresh, lc: params.get('lc'), rc: params.get('rc') });
  return NextResponse.json(result, {
    headers: { 'Cache-Control': fresh ? 'no-store' : 'private, max-age=3600' },
  });
}
