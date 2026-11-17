import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
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

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
