// Small pure helpers for the trip "ticket" cards: a three-letter code per
// city (like an airport code), and a barcode, derived from the trip so each
// ticket is its own but never changes.

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z\s'-]/g, '')
    .trim();
}

// "Vienna" → VIE, "Prague" → PRA, "New York" → NYE (initials, padded).
export function cityCode(name: string): string {
  const clean = normalize(name);
  const words = clean.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return '---';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase().padEnd(3, 'X');
  const initials = words.slice(0, 3).map((w) => w[0]).join('');
  return (initials + words[0].slice(1)).slice(0, 3).toUpperCase().padEnd(3, 'X');
}

// Names for the ticket's passengers line: the first few, then a count of the rest.
export function formatPassengers(names: string[], max = 3): { shown: string[]; more: number } {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  return { shown: clean.slice(0, max), more: Math.max(0, clean.length - max) };
}

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Bar widths (1–3 units) for a barcode that is the same every time for a trip.
export function barcodeBars(id: string, count = 30): number[] {
  let state = hash(id) || 1;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
    state = (state + 0x9e3779b9) >>> 0;
    bars.push((state % 3) + 1);
  }
  return bars;
}
