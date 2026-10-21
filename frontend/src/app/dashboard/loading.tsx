import { Skeleton, TableSkeleton } from "../components/skeleton";

// Shown by Next.js while a dashboard page's code and data load, instead of a blank panel.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col flex-1 w-full max-w-6xl px-10 py-10 mx-auto gap-8">
      <div className="flex justify-between items-center gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
