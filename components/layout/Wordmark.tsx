import { clsx } from "clsx";

type WordmarkSize = "sm" | "md" | "lg";

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
}

const sizeStyles: Record<WordmarkSize, { initials: string; clara: string }> = {
  sm: { initials: "text-xs font-bold", clara: "text-lg leading-tight" },
  md: { initials: "text-sm font-bold", clara: "text-2xl leading-tight" },
  lg: { initials: "text-base font-bold", clara: "text-4xl leading-tight" },
};

export default function Wordmark({ size = "md", className }: WordmarkProps) {
  const styles = sizeStyles[size];

  return (
    <div className={clsx("flex flex-col gap-0.5", className)}>
      <span className={clsx("text-clara-strong", styles.initials)}>SR</span>
      <span className={clsx("font-bold text-clara-primary", styles.clara)}>
        Clara
      </span>
    </div>
  );
}
