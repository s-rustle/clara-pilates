interface ProgressBarProps {
  value: number;
  label?: string;
  sublabel?: string;
}

export default function ProgressBar({ value, label, sublabel }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 text-sm font-medium text-clara-deep">{label}</div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-sm bg-clara-highlight">
        <div
          className="h-full rounded-sm bg-clara-accent transition-all duration-300"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {sublabel && (
        <div className="mt-1 text-xs text-clara-muted">{sublabel}</div>
      )}
    </div>
  );
}
