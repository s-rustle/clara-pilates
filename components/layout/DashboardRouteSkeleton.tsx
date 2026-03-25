/** Instant shell while dashboard `page.tsx` async work runs (see `app/(dashboard)/loading.tsx`). */
export default function DashboardRouteSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="border border-clara-border bg-white">
        <div className="h-4 w-40 bg-clara-border/80" />
        <div className="mt-6 grid grid-cols-1 gap-px bg-clara-border sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 bg-white p-4">
              <div className="h-2 w-24 bg-clara-border/90" />
              <div className="h-8 w-16 bg-clara-border/70" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="space-y-3 rounded-none border border-clara-border bg-white p-5 md:col-span-3">
          <div className="h-4 w-28 bg-clara-border/80" />
          <div className="h-2 w-full bg-clara-border/50" />
          <div className="h-2 w-[85%] bg-clara-border/50" />
        </div>
        <div className="space-y-3 rounded-none border border-clara-border bg-white p-5 md:col-span-2">
          <div className="h-4 w-32 bg-clara-border/80" />
          <div className="h-16 w-full bg-clara-tint/50" />
        </div>
      </div>
      <div className="space-y-4 rounded-none border border-clara-border bg-white p-5">
        <div className="h-4 w-36 bg-clara-border/80" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-clara-border/40" />
          ))}
        </div>
      </div>
      <div className="space-y-3 rounded-none border border-clara-border bg-white p-5">
        <div className="h-4 w-44 bg-clara-border/80" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 w-full border-b border-clara-border/60 last:border-0" />
        ))}
      </div>
    </div>
  );
}
