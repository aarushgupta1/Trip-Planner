import { describe, expect, it } from 'vitest';
import { cleanItemName, missingStarterItems, packedCount, sortItems, starterItems, PackingItem } from '@/lib/packing';

const item = (name: string, packed = false): PackingItem => ({ id: name, name, shared: false, mine: true, packed, addedBy: null });

describe('starterItems', () => {
  it('gives each trip type its own gear plus the basics', () => {
    expect(starterItems('ski')).toContain('Goggles');
    expect(starterItems('beach')).toContain('Sunscreen');
    expect(starterItems('sightseeing')).toContain('Comfortable walking shoes');
    expect(starterItems('ski')).toContain('Passport / ID');
    expect(starterItems('beach')).not.toContain('Goggles');
  });
});

describe('missingStarterItems', () => {
  it('skips what is already on the list, ignoring case', () => {
    const missing = missingStarterItems(['passport / id', 'Sunscreen'], 'beach');
    expect(missing).not.toContain('Passport / ID');
    expect(missing).not.toContain('Sunscreen');
    expect(missing).toContain('Swimsuit');
  });
});

describe('cleanItemName / sortItems / packedCount', () => {
  it('tidies whitespace and limits length', () => {
    expect(cleanItemName('  rain   jacket ')).toBe('rain jacket');
    expect(cleanItemName('x'.repeat(500)).length).toBe(120);
  });
  it('puts unpacked items first, then alphabetical', () => {
    expect(sortItems([item('b', true), item('c'), item('a')]).map((i) => i.name)).toEqual(['a', 'c', 'b']);
  });
  it('counts packed items', () => {
    expect(packedCount([item('a', true), item('b')])).toEqual({ packed: 1, total: 2 });
  });
});
