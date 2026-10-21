// Placeholder shapes shown while data loads, so a page looks busy rather than stuck.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-gray-200/80 dark:bg-white/10 ${className}`} />;
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading" className="border border-border bg-background rounded-lg overflow-hidden shadow-sm">
      <div className="flex gap-6 px-6 py-4 bg-muted">
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton key={column} className={`h-3 ${column === 0 ? "w-40" : "w-20"}`} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-6 px-6 py-5 border-t border-border">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className={`h-4 ${column === 0 ? "w-56" : column === columns - 1 ? "w-16 ml-auto" : "w-24"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center justify-between gap-4 border border-gray-200 rounded-xl p-4">
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
