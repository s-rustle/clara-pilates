interface TopBarProps {
  title: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-clara-highlight/50 bg-clara-surface px-6">
      <h1 className="font-bold text-clara-strong">{title}</h1>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-clara-primary text-sm font-medium text-white">
        SC
      </div>
    </header>
  );
}
