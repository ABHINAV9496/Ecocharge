export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="h-8 w-24 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
      <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

export function SkeletonTable({ rows }) {
  rows = rows || 4
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
      {Array.from({ length: rows }, function (_, i) {
        return (
          <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/5 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-1/6 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700 ml-auto" />
          </div>
        )
      })}
    </div>
  )
}

export function SkeletonList({ items }) {
  items = items || 3
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: items }, function (_, i) {
        return (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl" />
        )
      })}
    </div>
  )
}

export function SkeletonStats({ count }) {
  count = count || 4
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }, function (_, i) {
        return <SkeletonCard key={i} />
      })}
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="animate-pulse bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700 mb-6" />
      <div className="h-48 rounded bg-gray-100 dark:bg-gray-800" />
    </div>
  )
}
