function daysUntilExam(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const target = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

interface TopBarProps {
  title: string;
  examTargetDate?: string | null;
}

export default function TopBar({ title, examTargetDate = null }: TopBarProps) {
  const delta = daysUntilExam(examTargetDate);
  const showExamBadge = delta !== null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-clara-border bg-clara-bg px-4 sm:px-6">
      <h1 className="font-cormorant min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-clara-deep sm:text-2xl md:text-3xl">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-3">
        {showExamBadge ? (
          <span className="inline-flex items-center rounded-none bg-clara-accent px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-clara-deep">
            {delta === 0
              ? "Exam today"
              : delta! > 0
                ? `${delta}d`
                : "Past"}
          </span>
        ) : null}
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-clara-border bg-clara-surface text-[10px] font-semibold uppercase tracking-wide text-clara-muted"
          aria-hidden
        >
          SR
        </div>
      </div>
    </header>
  );
}
