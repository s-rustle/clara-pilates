interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-clara-border/80 bg-clara-bg/95 px-4 shadow-sm backdrop-blur-sm sm:px-6">
      <h1 className="font-display truncate text-lg font-semibold tracking-tight text-clara-accent sm:text-xl md:text-2xl">
        {title}
      </h1>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-clara-border bg-clara-surface text-xs font-black text-clara-deep"
        aria-hidden
      >
        SR
      </div>
    </header>
  );
}
