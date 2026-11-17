import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

// Browser-side Supabase client. Uses @supabase/ssr so the signed-in user's
// session (stored in cookies) is attached to every request and to the
// Realtime connection — which is what lets Row Level Security show each
// person only their own trips.
export function getSupabaseClient(): SupabaseClient | null {
  // .trim() guards against a stray leading/trailing space or newline getting
  // pasted into the env var value (e.g. in the Vercel dashboard) — that alone
  // is enough to make the Realtime websocket's HTTP auth handshake fail with
  // "no valid credentials available", since the key is sent verbatim as a
  // URL query param.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  if (!_client) _client = createBrowserClient(url, key);
  return _client;
}
