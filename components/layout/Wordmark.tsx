import { clsx } from "clsx";

type WordmarkSize = "sm" | "md" | "lg";

/** `sidebar`: narrow rail (Clara only, matches reference); `login`: centered auth hero */
type WordmarkVariant = "default" | "sidebar" | "login";

interface WordmarkProps {
  size?: WordmarkSize;
  variant?: WordmarkVariant;
  className?: string;
}

/** SR — Inter, muted caps; Clara — Cormorant (default sizes include both) */
const sizeStyles: Record<WordmarkSize, { initials: string; clara: string }> = {
  sm: {
    initials: "text-[10px] font-medium uppercase tracking-[0.15em] text-clara-muted",
    clara:
      "font-cormorant text-[clamp(2rem,8vw,2.75rem)] font-semibold leading-[0.9] tracking-[-0.02em] text-clara-deep",
  },
  md: {
    initials: "text-xs font-medium uppercase tracking-[0.15em] text-clara-muted",
    clara:
      "font-cormorant text-[clamp(2.25rem,7vw,3.25rem)] font-semibold leading-[0.9] tracking-[-0.02em] text-clara-deep",
  },
  lg: {
    initials: "text-sm font-medium uppercase tracking-[0.15em] text-clara-muted",
    clara:
      "font-cormorant text-[clamp(2.75rem,6vw,4rem)] font-semibold leading-[0.9] tracking-[-0.02em] text-clara-deep",
  },
};

export default function Wordmark({
  size = "md",
  variant = "default",
  className,
}: WordmarkProps) {
  if (variant === "login") {
    return (
      <div
        className={clsx(
          "flex w-full max-w-full flex-col items-stretch text-center",
          className
        )}
      >
        {/* Scales up from reference 56px to fill the auth column (clara_cycladic_final.html) */}
        <span
          className="font-cormorant font-light leading-[0.92] tracking-[-0.033em] text-clara-deep text-[clamp(3.5rem,min(21vw,18vh),6.75rem)]"
        >
          Clara
        </span>
        <span
          className="mt-1 text-[9px] font-normal uppercase text-clara-muted [letter-spacing:4px]"
        >
          Balanced Body Prep
        </span>
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className={clsx("w-full min-w-0", className)}>
        {/* Fills the 140px rail: scales with sidebar container (~32–44px), matches page title weight */}
        <span className="block w-full font-cormorant text-[clamp(2rem,30cqw,2.875rem)] font-semibold leading-[0.88] tracking-[-0.025em] text-clara-deep">
          Clara
        </span>
      </div>
    );
  }

  const styles = sizeStyles[size];

  return (
    <div className={clsx("flex w-full min-w-0 flex-col gap-1", className)}>
      <span className={styles.initials}>SR</span>
      <span className={clsx("font-cormorant", styles.clara)}>Clara</span>
    </div>
  );
}
