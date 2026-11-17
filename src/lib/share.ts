// Helpers for sending a trip invite: the message that goes with the link, and
// the phone's own share sheet (Messages, WhatsApp, email…) where it exists.

export function inviteMessage(tripName: string, dateRange: string): string {
  const when = dateRange ? ` (${dateRange})` : '';
  return `Join me in planning "${tripName}"${when} on Aero.`;
}

export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'error';

// Opens the system share sheet. 'cancelled' means the person closed it — not
// an error, so callers shouldn't complain.
export async function shareInvite(data: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (!canNativeShare()) return 'unsupported';
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    return (e as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'error';
  }
}
