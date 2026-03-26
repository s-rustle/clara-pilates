import { clsx } from "clsx";

interface ProgressBarProps {
  value: number;
  label?: string;
  /** Large Cormorant stat (e.g. "72.5%", "124") — shown below label, above bar */
  metric?: string;
  /** Small muted line after the bar */
  caption?: string;
  /** Hours-style bars use lemon accent; readiness/quiz use grove green */
  tone?: "primary" | "accent";
}

export default function ProgressBar({
  value,
  label,
  metric,
  caption,
  tone = "primary",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div>
      {label ? (
        <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.2em] text-clara-muted">
          {label}
        </div>
      ) : null}
      {metric ? (
        <div className="mb-2 font-cormorant text-[36px] font-semibold leading-none tabular-nums text-clara-deep">
          {metric}
        </div>
      ) : null}
      <div className="h-0.5 w-full overflow-hidden bg-clara-border">
        <div
          className={clsx(
            "h-full transition-all duration-300",
            tone === "accent" ? "bg-clara-accent" : "bg-clara-primary"
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {caption ? (
        <div className="mt-1 text-xs text-clara-muted">{caption}</div>
      ) : null}
    </div>
  );
}
