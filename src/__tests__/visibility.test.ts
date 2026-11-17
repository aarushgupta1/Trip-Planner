import { describe, expect, it } from 'vitest';
import { audienceLabel, canSeeAttraction, normalizeVisibility } from '@/lib/visibility';

describe('canSeeAttraction', () => {
  it('shows everything with no audience, and old events with no creator', () => {
    expect(canSeeAttraction({ visible_to: null, created_by: 'a' }, 'b')).toBe(true);
    expect(canSeeAttraction({ visible_to: ['a'], created_by: null }, 'b')).toBe(true);
  });
  it('limits to the creator and listed people', () => {
    const ev = { created_by: 'a', visible_to: ['a', 'c'] };
    expect(canSeeAttraction(ev, 'a')).toBe(true);
    expect(canSeeAttraction(ev, 'c')).toBe(true);
    expect(canSeeAttraction(ev, 'b')).toBe(false);
  });
});

describe('normalizeVisibility', () => {
  const all = ['a', 'b', 'c'];
  it('keeps null as everyone', () => expect(normalizeVisibility(null, 'a', all)).toBeNull());
  it('always includes the creator and drops strangers', () => {
    expect(normalizeVisibility(['b', 'zzz'], 'a', all)?.sort()).toEqual(['a', 'b']);
  });
  it('collapses to everyone when the whole trip is picked', () => {
    expect(normalizeVisibility(['b', 'c'], 'a', all)).toBeNull();
  });
  it('only me', () => expect(normalizeVisibility([], 'a', all)).toEqual(['a']));
});

describe('audienceLabel', () => {
  const people = [{ user_id: 'a', display_name: 'Ann' }, { user_id: 'b', display_name: 'Bo' }];
  it('describes the audience', () => {
    expect(audienceLabel(null, people, 'a')).toBe('Everyone on the trip');
    expect(audienceLabel(['a'], people, 'a')).toBe('Only the person who added it');
    expect(audienceLabel(['a', 'b'], people, 'a')).toBe('Bo');
  });
});
