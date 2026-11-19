// The app mark: a star split down the middle, blue on the left and red on
// the right, matching the ticket palette. Works in light and dark mode.
const STAR =
  'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z';

export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0" strokeLinejoin="round" strokeWidth={1.5}>
      <defs>
        <clipPath id="brand-left"><rect x="0" y="0" width="12" height="24" /></clipPath>
        <clipPath id="brand-right"><rect x="12" y="0" width="12" height="24" /></clipPath>
      </defs>
      <g clipPath="url(#brand-left)" className="fill-blue-600 stroke-blue-600 dark:fill-blue-500 dark:stroke-blue-500">
        <path d={STAR} />
      </g>
      <g clipPath="url(#brand-right)" className="fill-red-600 stroke-red-600 dark:fill-red-500 dark:stroke-red-500">
        <path d={STAR} />
      </g>
    </svg>
  );
}
