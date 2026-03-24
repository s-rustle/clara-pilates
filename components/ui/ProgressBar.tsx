interface ProgressBarProps {
  value: number;
  label?: string;
  sublabel?: string;
}

export default function ProgressBar({ value, label, sublabel }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div>
      {label ? (
        <div className="mb-1 text-sm font-medium text-clara-deep">{label}</div>
      ) : null}
      <div className="h-2 w-full overflow-hidden rounded-sm bg-clara-tint">
        <div
          className="h-full rounded-sm bg-clara-primary transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {sublabel ? (
        <div className="mt-1 text-xs text-clara-muted">{sublabel}</div>
      ) : null}
    </div>
  );
}
