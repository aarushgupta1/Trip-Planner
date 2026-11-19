// Shown the instant a trip is clicked, while its data loads — so the screen
// changes immediately instead of sitting on the old page.
export default function Loading() {
  return (
    <main className="h-dvh flex flex-col bg-gray-50 dark:bg-gray-950" aria-busy="true" aria-label="Loading trip">
      <header className="h-14 shrink-0 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 flex items-center gap-3">
        <div className="h-5 w-5 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-64 shrink-0 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:block">
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
        <div className="flex flex-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-1 border-l border-gray-100 p-3 first:border-l-0 dark:border-gray-800">
              <div className="mx-auto h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              <div className="mt-6 h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/70" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
