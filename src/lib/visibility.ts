// Who can see an event. `visible_to` null means everyone on the trip;
// otherwise it lists the people (user ids) who can, and always includes the
// person who created it. Rows from before this existed have no creator and
// stay visible to everyone.
export interface VisibilityFields {
  created_by?: string | null;
  visible_to?: string[] | null;
}

export function canSeeAttraction(a: VisibilityFields, userId: string): boolean {
  if (!a.visible_to) return true;
  if (!a.created_by) return true;
  return a.created_by === userId || a.visible_to.includes(userId);
}

// Cleans up a chosen audience: only people actually on the trip, the creator
// always included, and "everyone" (null) if that's effectively the whole trip.
export function normalizeVisibility(
  selected: string[] | null | undefined,
  creatorId: string,
  tripPeopleIds: string[]
): string[] | null {
  if (!selected) return null;
  const valid = new Set(tripPeopleIds);
  const ids = new Set(selected.filter((id) => valid.has(id)));
  ids.add(creatorId);
  if (tripPeopleIds.every((id) => ids.has(id))) return null;
  return [...ids];
}

export function audienceLabel(
  visibleTo: string[] | null | undefined,
  people: { user_id: string; display_name: string }[],
  currentUserId: string
): string {
  if (!visibleTo) return 'Everyone on the trip';
  const others = people.filter((p) => visibleTo.includes(p.user_id) && p.user_id !== currentUserId);
  if (others.length === 0) return 'Only the person who added it';
  return others.map((p) => p.display_name).join(', ');
}
