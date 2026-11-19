// The six handwriting styles a passenger's name can appear in on a ticket.
// Each person is assigned one at random when they join a trip (stored as an
// index 0-5), so it never changes afterwards. Two people can share a style.
export interface PassengerFont {
  family: string; // CSS font-family, using the variable set up in layout.tsx
  size: number; // px; the fonts differ a lot in how big they look
}

export const PASSENGER_FONTS: PassengerFont[] = [
  { family: "var(--font-nanum-pen), cursive", size: 22 },
  { family: "var(--font-caveat), cursive", size: 24 },
  { family: "var(--font-kalam), cursive", size: 17 },
  { family: "var(--font-shadows), cursive", size: 20 },
  { family: "var(--font-reenie), cursive", size: 26 },
  { family: "var(--font-homemade), cursive", size: 15 },
];

export function passengerFont(index: number | null | undefined): PassengerFont {
  const n = Number.isInteger(index) ? (index as number) : 0;
  return PASSENGER_FONTS[((n % PASSENGER_FONTS.length) + PASSENGER_FONTS.length) % PASSENGER_FONTS.length];
}
