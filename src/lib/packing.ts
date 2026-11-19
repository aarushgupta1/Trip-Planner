import type { TripType } from './utils';

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

// Starter ideas per kind of trip. Everyone gets the basics.
const BASICS = ['Passport / ID', 'Phone charger', 'Wallet and cards', 'Medications', 'Toiletries', 'Underwear and socks'];

const BY_TRIP_TYPE: Record<TripType, string[]> = {
  sightseeing: ['Comfortable walking shoes', 'Day bag', 'Portable battery', 'Reusable water bottle', 'Rain jacket', 'Travel adapter'],
  ski: ['Ski jacket', 'Ski pants', 'Base layers', 'Goggles', 'Gloves or mittens', 'Warm hat and neck gaiter', 'Wool socks', 'Lip balm and sunscreen', 'Helmet (if not renting)'],
  beach: ['Swimsuit', 'Sunscreen', 'Sunglasses', 'Beach towel', 'Flip-flops', 'Hat', 'Light cover-up', 'After-sun lotion'],
};

export function starterItems(type: TripType): string[] {
  return [...BASICS, ...(BY_TRIP_TYPE[type] ?? BY_TRIP_TYPE.sightseeing)];
}

const key = (s: string) => s.trim().toLowerCase();

// Starter items that aren't already on the list (case-insensitive).
export function missingStarterItems(existingNames: string[], type: TripType): string[] {
  const have = new Set(existingNames.map(key));
  return starterItems(type).filter((n) => !have.has(key(n)));
}

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
