export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-6 w-48 bg-muted rounded-md" />
        <div className="h-9 w-28 bg-muted rounded-lg" />
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-card border rounded-xl p-4 space-y-2">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-7 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Content Skeleton Cards */}
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-card border rounded-xl p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-5 w-40 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
            <div className="h-4 w-60 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

