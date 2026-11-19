export interface PackingItem {
  id: string;
  name: string;
  shared: boolean;
  mine: boolean; // added by the signed-in person (only they can remove or re-share it)
  packed: boolean; // this person's own tick
  addedBy: string | null; // display name, for shared items added by someone else
}

export const MAX_PACKING_ITEM_CHARS = 120;
export const MAX_PACKING_ITEMS = 300;

export function cleanItemName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_PACKING_ITEM_CHARS);
}

// Unpacked first, then packed; each group alphabetical.
export function sortItems(items: PackingItem[]): PackingItem[] {
  return [...items].sort((a, b) => Number(a.packed) - Number(b.packed) || a.name.localeCompare(b.name));
}

export function packedCount(items: PackingItem[]): { packed: number; total: number } {
  return { packed: items.filter((i) => i.packed).length, total: items.length };
}
