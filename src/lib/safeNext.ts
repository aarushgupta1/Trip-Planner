// Only ever redirect to a path on this site (never an external URL).
export function safeNext(next: string | undefined | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

// "/signup" or "/signup?next=%2Fjoin%2Fabc" — keeps an invite link alive
// through sign-up / sign-in.
export function withNext(path: string, next: string): string {
  return next === '/' ? path : `${path}?next=${encodeURIComponent(next)}`;
}
