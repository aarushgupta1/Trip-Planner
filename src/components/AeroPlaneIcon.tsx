// The plane icon with a blue tail and a red nose (outline only). Drawn
// pointing right.
export default function AeroPlaneIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="rotate-45"
    >
      <defs>
        <linearGradient id="aero-plane-stroke" gradientUnits="userSpaceOnUse" x1="3" y1="21" x2="21" y2="3">
          <stop offset="0.5" stopColor="#2563eb" />
          <stop offset="0.5" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <path
        stroke="url(#aero-plane-stroke)"
        d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.2.4c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.4-.2c.4-.3.6-.7.5-1.2z"
      />
    </svg>
  );
}
