interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-clara-border/90 bg-clara-bg/95 px-4 backdrop-blur-md sm:px-6">
      <h1 className="truncate text-lg font-bold tracking-tight text-clara-strong sm:text-xl md:text-2xl">
        {title}
      </h1>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-clara-border bg-clara-surface text-xs font-bold text-clara-strong"
        aria-hidden
      >
        SR
      </div>
    </header>
  );
}
