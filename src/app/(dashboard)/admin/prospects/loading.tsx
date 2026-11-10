export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse" role="status" aria-label="Loading prospects">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-gray-100" />)}
      </div>
      <div className="h-80 rounded-2xl bg-gray-100" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
