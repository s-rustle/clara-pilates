import { clsx } from "clsx";

type WordmarkSize = "sm" | "md" | "lg";

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
}

const sizeStyles: Record<WordmarkSize, { initials: string; clara: string }> = {
  sm: { initials: "text-xs font-black", clara: "text-lg font-light leading-tight" },
  md: { initials: "text-sm font-black", clara: "text-2xl font-light leading-tight" },
  lg: { initials: "text-base font-black", clara: "text-4xl font-light leading-tight" },
};

export default function Wordmark({ size = "md", className }: WordmarkProps) {
  const styles = sizeStyles[size];

  return (
    <div className={clsx("flex flex-col gap-0.5", className)}>
      <span className={clsx("text-clara-strong", styles.initials)}>SR</span>
      <span className={clsx("text-clara-accent", styles.clara)}>Clara</span>
    </div>
  );
}
