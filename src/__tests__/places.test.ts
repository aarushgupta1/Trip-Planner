import { describe, it, expect } from 'vitest';
import { formatPlaceForModel, parsePlaceResponse } from '@/lib/places';

const RAW = {
  places: [
    {
      displayName: { text: 'Belvedere' },
      formattedAddress: 'Prinz-Eugen-Straße 27, 1030 Wien, Austria',
      businessStatus: 'OPERATIONAL',
      regularOpeningHours: { weekdayDescriptions: ['Monday: 9:00 AM – 6:00 PM'] },
      currentOpeningHours: { openNow: true, weekdayDescriptions: ['Monday: 9:00 AM – 6:00 PM', 'Tuesday: Closed'] },
      rating: 4.6,
      userRatingCount: 51234,
      priceLevel: 'PRICE_LEVEL_MODERATE',
      websiteUri: 'https://www.belvedere.at',
      googleMapsUri: 'https://maps.google.com/?cid=1',
    },
  ],
};

describe('places', () => {
  it('parses a Text Search response', () => {
    const p = parsePlaceResponse(RAW)!;
    expect(p.name).toBe('Belvedere');
    expect(p.status).toBe('OPERATIONAL');
    expect(p.openNow).toBe(true);
    expect(p.weekHours).toHaveLength(2); // current hours win over regular
    expect(p.rating).toBe(4.6);
    expect(p.priceLevel).toBe('Moderate');
  });
  it('falls back to regular hours and tolerates missing fields', () => {
    const p = parsePlaceResponse({ places: [{ displayName: { text: 'X' }, regularOpeningHours: { weekdayDescriptions: ['a'] } }] })!;
    expect(p.weekHours).toEqual(['a']);
    expect(p.openNow).toBeNull();
    expect(p.status).toBe('UNKNOWN');
    expect(p.rating).toBeNull();
  });
  it('returns null when nothing was found', () => {
    expect(parsePlaceResponse({})).toBeNull();
    expect(parsePlaceResponse({ places: [] })).toBeNull();
    expect(parsePlaceResponse(null)).toBeNull();
  });
  it('formats for the model, flagging closures', () => {
    const p = parsePlaceResponse(RAW)!;
    const text = formatPlaceForModel(p);
    expect(text).toContain('Belvedere');
    expect(text).toContain('Open right now: yes');
    expect(text).toContain('Tuesday: Closed');
    const closed = formatPlaceForModel({ ...p, status: 'CLOSED_PERMANENTLY', openNow: null });
    expect(closed).toContain('PERMANENTLY CLOSED');
  });
});
