import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static files, the service worker, the PWA manifest and icons.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon.svg|icon-192.png|icon-512.png|apple-touch-icon.png|api/send-event-reminders).*)',
  ],
};
