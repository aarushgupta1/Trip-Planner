import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Paths reachable without being signed in.
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// Runs on every page request: refreshes the auth cookie if it's about to
// expire, sends signed-out visitors to /login, and sends signed-in visitors
// away from the login/sign-up screens.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  // Not configured yet: let the app render its own "set up Supabase" notice.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims() (not getSession()) verifies the token's signature and
  // refreshes it when it's about to expire — without a network round trip to
  // Supabase Auth on every page view when the project uses asymmetric keys.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;
  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const home = request.nextUrl.clone();
    home.pathname = '/';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}
