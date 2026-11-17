import { describe, it, expect } from 'vitest';
import { inviteMessage } from '@/lib/share';

describe('inviteMessage', () => {
  it('names the trip and dates', () => {
    expect(inviteMessage('Rome in spring', 'Mar 28 – Apr 9')).toBe('Join me in planning "Rome in spring" (Mar 28 – Apr 9) on Aero.');
  });
  it('leaves the dates out when unknown', () => {
    expect(inviteMessage('Rome', '')).toBe('Join me in planning "Rome" on Aero.');
  });
});
