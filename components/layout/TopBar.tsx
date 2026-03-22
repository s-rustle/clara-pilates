interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-clara-border/90 bg-clara-bg/95 px-6 backdrop-blur-md">
      <h1 className="font-display text-xl font-normal tracking-tight text-clara-ink md:text-2xl">
        {title}
      </h1>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full border border-clara-border bg-clara-surface text-xs font-semibold text-clara-ink"
        aria-hidden
      >
        SR
      </div>
    </header>
  );
}
