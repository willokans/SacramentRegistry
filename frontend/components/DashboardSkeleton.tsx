'use client';

/**
 * Loading skeleton for the dashboard. Mirrors the layout of stat cards,
 * quick actions, chart, and recent records sections.
 */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading dashboard" data-testid="dashboard-skeleton">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded bg-gray-200 animate-pulse" aria-hidden />
              <span className="h-4 w-24 rounded bg-gray-200 animate-pulse" aria-hidden />
            </div>
            <div className="mt-2 h-8 w-20 rounded bg-gray-200 animate-pulse" aria-hidden />
          </div>
        ))}
      </div>

      {/* Quick Actions skeleton */}
      <div>
        <div className="h-5 w-28 rounded bg-gray-200 animate-pulse mb-2" aria-hidden />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`rounded-lg bg-gray-200 animate-pulse ${i === 1 ? 'h-[44px] w-40' : 'h-[44px] w-32 border border-gray-100'}`}
              aria-hidden
            />
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="h-5 w-56 rounded bg-gray-200 animate-pulse mb-1" aria-hidden />
        <div className="h-3 w-48 rounded bg-gray-200 animate-pulse mb-2" aria-hidden />
        <div className="w-full overflow-x-auto pb-1">
          <div className="flex items-end gap-2 h-56 w-full min-w-0 border-b border-gray-100">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div
                key={i}
                className="flex-1 min-w-[2rem] h-full flex flex-col items-center justify-end gap-1"
              >
                <div
                  className="w-full rounded-t bg-gray-200 animate-pulse"
                  style={{ height: `${30 + (i % 5) * 10}%`, minHeight: 24 }}
                  aria-hidden
                />
                <span className="h-3 w-6 rounded bg-gray-200 animate-pulse shrink-0" aria-hidden />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-gray-200 animate-pulse" aria-hidden />
              <span className="h-4 w-20 rounded bg-gray-200 animate-pulse" aria-hidden />
            </div>
          ))}
        </div>
      </section>

      {/* Latest records + Recent Activity skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="h-5 w-44 rounded bg-gray-200 animate-pulse mb-2" aria-hidden />
          <ul className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex items-center gap-2 py-2">
                <span className="h-4 w-16 rounded bg-gray-200 animate-pulse" aria-hidden />
                <span className="h-4 flex-1 rounded bg-gray-200 animate-pulse" aria-hidden />
                <span className="h-3 w-20 rounded bg-gray-200 animate-pulse" aria-hidden />
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" aria-hidden />
            <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" aria-hidden />
          </div>
          <ul className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" aria-hidden />
                  <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" aria-hidden />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
