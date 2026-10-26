import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

// Target of the email confirmation link: exchanges the code for a session.
export async function GET(request) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  }
  return NextResponse.redirect(`${origin}/login?error=confirm`);
}
