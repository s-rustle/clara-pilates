import { clsx } from "clsx";

type WordmarkSize = "sm" | "md" | "lg";

/** `sidebar`: scales with narrow column width (container query) */
type WordmarkVariant = "default" | "sidebar";

interface WordmarkProps {
  size?: WordmarkSize;
  variant?: WordmarkVariant;
  className?: string;
}

/** SR — muted caps; Clara — Fraunces bold, primary green */
const sizeStyles: Record<WordmarkSize, { initials: string; clara: string }> = {
  sm: {
    initials: "text-[10px] font-black tracking-wide text-clara-muted",
    clara:
      "w-full text-[clamp(2.75rem,11vw,3.45rem)] font-bold leading-[0.88] tracking-[-0.02em] text-clara-primary sm:text-[3.55rem]",
  },
  md: {
    initials: "text-xs font-black tracking-wide text-clara-muted",
    clara:
      "w-full text-[clamp(2.85rem,8vw,3.75rem)] font-bold leading-[0.9] tracking-[-0.02em] text-clara-primary sm:text-[4.25rem]",
  },
  lg: {
    initials: "text-sm font-black tracking-wide text-clara-muted",
    clara:
      "w-full text-[clamp(3.25rem,7vw,4.5rem)] font-bold leading-[0.9] tracking-[-0.02em] text-clara-primary sm:text-[5rem]",
  },
};

export default function Wordmark({
  size = "md",
  variant = "default",
  className,
}: WordmarkProps) {
  const styles = sizeStyles[size];
  const claraClass =
    variant === "sidebar"
      ? "block w-full min-w-0 max-w-full font-display text-[clamp(3rem,34cqw,4.75rem)] font-bold leading-[0.82] tracking-[-0.035em] text-clara-primary"
      : clsx("font-display", styles.clara);

  return (
    <div className={clsx("flex w-full min-w-0 flex-col gap-1", className)}>
      <span className={styles.initials}>SR</span>
      <span className={claraClass}>Clara</span>
    </div>
  );
}
