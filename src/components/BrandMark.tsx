import { Star } from 'lucide-react';

// The app mark: a blue star, matching the ticket palette. Works in both
// light and dark mode.
export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Star
      aria-hidden
      size={size}
      strokeWidth={1.5}
      strokeLinejoin="round"
      className="shrink-0 fill-blue-600 text-blue-600 dark:fill-blue-500 dark:text-blue-500"
    />
  );
}
