// The app mark: a six-pointed star cut into six even sections that
// alternate blue and red, matching the ticket palette. A thin white seam
// keeps the sections reading as separate pieces.
const CX = 12;
const CY = 12;
const OUTER = 10.5;
const INNER = 5.8;
const POINTS = 6;
const STEP = 360 / POINTS;

const point = (radius: number, angleDeg: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return `${(CX + radius * Math.cos(a)).toFixed(2)},${(CY + radius * Math.sin(a)).toFixed(2)}`;
};

// Section k: the star's centre, then the dip before point k, the point
// itself, and the dip after it.
const SECTIONS = Array.from({ length: POINTS }, (_, k) => {
  const tip = -90 + STEP * k;
  return `${CX},${CY} ${point(INNER, tip - STEP / 2)} ${point(OUTER, tip)} ${point(INNER, tip + STEP / 2)}`;
});

const BLUE = '#2563eb';
const RED = '#dc2626';

export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      {SECTIONS.map((pts, i) => (
        <polygon key={i} points={pts} fill={i % 2 === 0 ? BLUE : RED} stroke="#ffffff" strokeWidth={0.5} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
