import { clsx } from "clsx";

type WordmarkSize = "sm" | "md" | "lg";

interface WordmarkProps {
  size?: WordmarkSize;
  className?: string;
}

const sizeStyles: Record<
  WordmarkSize,
  { initials: string; clara: string }
> = {
  sm: { initials: "text-lg", clara: "text-xs" },
  md: { initials: "text-2xl", clara: "text-sm" },
  lg: { initials: "text-4xl", clara: "text-base" },
};

export default function Wordmark({ size = "md", className }: WordmarkProps) {
  const styles = sizeStyles[size];

  return (
    <div className={clsx("flex flex-col", className)}>
      <span
        className={clsx("font-bold text-clara-strong", styles.initials)}
      >
        SR
      </span>
      <span
        className={clsx("font-normal text-clara-primary", styles.clara)}
      >
        Clara
      </span>
    </div>
  );
}
