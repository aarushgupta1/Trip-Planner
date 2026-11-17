import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

// Server-side Supabase client bound to the current request's cookies — so
// every query runs *as the signed-in user* and Row Level Security applies.
// (Never use a plain anon-key client for user data: with RLS on it would
// see nothing.)
export async function createSupabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only —
            // fine, the proxy refreshes the session on every request anyway.
          }
        },
      },
    }
  );
}

export interface CurrentUser {
  id: string;
  email: string | undefined;
  user_metadata: Record<string, unknown>;
}

// Who's signed in, for rendering. Checked from the session token's signature
// (no round trip to Supabase Auth when the project uses asymmetric signing
// keys; otherwise the library falls back to asking the Auth server), and
// memoized per request so the several places that ask — page, metadata,
// data loaders — share one check. Anything that *writes* on someone's behalf
// still uses getUser() directly, and Row Level Security guards the data
// either way.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    user_metadata: (claims.user_metadata as Record<string, unknown> | undefined) ?? {},
  };
});
