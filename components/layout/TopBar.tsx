interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-clara-highlight bg-clara-bg px-4 sm:px-6">
      <h1 className="truncate text-lg font-bold tracking-tight text-clara-strong sm:text-xl md:text-2xl">
        {title}
      </h1>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-clara-highlight bg-clara-surface text-xs font-black text-clara-strong"
        aria-hidden
      >
        SR
      </div>
    </header>
  );
}
