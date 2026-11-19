// The app mark: a five-pointed star cut into five even sections that
// alternate blue and red, matching the ticket palette. Five is odd, so the
// last section (blue) sits next to the first (also blue); a thin white seam
// keeps them reading as separate sections.
const CX = 12;
const CY = 12;
const OUTER = 10.5;
const INNER = 4.7;

const point = (radius: number, angleDeg: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return `${(CX + radius * Math.cos(a)).toFixed(2)},${(CY + radius * Math.sin(a)).toFixed(2)}`;
};

// Section k: the star's centre, then the dip before point k, the point
// itself, and the dip after it.
const SECTIONS = Array.from({ length: 5 }, (_, k) => {
  const tip = -90 + 72 * k;
  return `${CX},${CY} ${point(INNER, tip - 36)} ${point(OUTER, tip)} ${point(INNER, tip + 36)}`;
});

const FILLS = ['#2563eb', '#dc2626', '#2563eb', '#dc2626', '#2563eb'];

export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      {SECTIONS.map((pts, i) => (
        <polygon key={i} points={pts} fill={FILLS[i]} stroke="#ffffff" strokeWidth={0.5} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
