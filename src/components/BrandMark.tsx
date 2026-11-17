// The app mark: a blue square with a short red base, matching the ticket
// palette. Pure CSS so it works in both light and dark mode.
export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[4px] bg-blue-600 border-b-[5px] border-red-600 dark:bg-blue-500 dark:border-red-500"
      style={{ width: size, height: size }}
    />
  );
}
