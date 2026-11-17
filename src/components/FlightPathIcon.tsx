// Replaces the chevron arrows for paging through days: a plane's final
// approach drawn as a single line, ending in an arrowhead. "next" is the descent (a curve that dives
// and flattens, like the left half of a parabola) followed by the straight
// run along the runway; "prev" is the same path mirrored, so the runway is on
// the left and the line climbs away to the right.
export default function FlightPathIcon({
  direction,
  size = 24,
  className,
}: {
  direction: 'prev' | 'next';
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={direction === 'next' ? 'M4 4 Q10 19 15 19 H21' : 'M20 4 Q14 19 9 19 H3'} />
      {/* Arrowhead at the end of the run, pointing the way the button goes. */}
      <path d={direction === 'next' ? 'M17.5 15.5 L21 19 L17.5 22.5' : 'M6.5 15.5 L3 19 L6.5 22.5'} />
    </svg>
  );
}
