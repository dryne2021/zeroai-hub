export default function Loading() {
  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-64 animate-pulse rounded-control bg-thread/60" />
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-panel bg-white ring-1 ring-thread" />)}
      </div>
    </div>
  );
}
