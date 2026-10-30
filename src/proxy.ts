import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { MISSING_ENV_MESSAGE, readSupabaseEnv } from '@/lib/supabase/env';

const PUBLIC_PATHS = ['/login', '/auth/'];

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const env = readSupabaseEnv();
  if (!env) {
    // Fail loudly with a readable reason instead of an opaque middleware crash.
    console.error(MISSING_ENV_MESSAGE);
    return new NextResponse(MISSING_ENV_MESSAGE, { status: 503 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getSession reads from the cookie — no network round-trip, safe for middleware.
  const { data: { session } } = await supabase.auth.getSession();
  const signedIn = Boolean(session?.user);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));

  if (!signedIn && !isPublic && !pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (signedIn && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|jpg|svg|ico|webp)$).*)'],
};
