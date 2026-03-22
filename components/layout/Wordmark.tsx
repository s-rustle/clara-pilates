import { clsx } from "clsx";

type WordmarkSize = "sm" | "md" | "lg";

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
}

const sizeStyles: Record<WordmarkSize, { initials: string; clara: string }> = {
  /** Sidebar — large Inter mark to fill the header band */
  sm: {
    initials: "text-[10px] font-black tracking-wide text-clara-muted",
    clara:
      "w-full text-[2.45rem] font-black leading-[0.9] tracking-tight text-clara-strong sm:text-[2.7rem]",
  },
  md: {
    initials: "text-xs font-black tracking-wide text-clara-muted",
    clara: "text-4xl font-black leading-tight tracking-tight text-clara-strong sm:text-5xl",
  },
  lg: {
    initials: "text-sm font-black tracking-wide text-clara-muted",
    clara: "text-5xl font-black leading-tight tracking-tight text-clara-strong sm:text-6xl",
  },
};

export default function Wordmark({ size = "md", className }: WordmarkProps) {
  const styles = sizeStyles[size];

  return (
    <div className={clsx("flex w-full min-w-0 flex-col gap-1", className)}>
      <span className={styles.initials}>SR</span>
      <span className={clsx("font-sans", styles.clara)}>Clara</span>
    </div>
  );
}
