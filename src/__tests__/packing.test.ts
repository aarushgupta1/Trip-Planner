import { describe, expect, it } from 'vitest';
import { cleanItemName, packedCount, sortItems, PackingItem } from '@/lib/packing';

const item = (name: string, packed = false): PackingItem => ({ id: name, name, shared: false, mine: true, packed, addedBy: null });

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
