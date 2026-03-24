import { clsx } from "clsx";

type BadgeVariant = "green" | "yellow" | "red" | "grey" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

/**
 * Maps to spec: Primary (green/white), Warm (peach + orange text),
 * Soft (tint + green text via blue), Accent (orange/white), Dark (deep/white).
 */
const variantStyles: Record<BadgeVariant, string> = {
  /** Primary — grove green, white text */
  green: "bg-clara-primary text-white",
  /** Warm — pale wash, accent-colored text */
  yellow:
    "bg-clara-accent-soft text-clara-accent ring-1 ring-inset ring-clara-accent/22",
  /** Dark label — deep forest, white text */
  red: "bg-clara-deep text-white",
  grey: "border border-clara-border bg-clara-surface text-clara-deep",
  /** Soft + Accent solid — tint / primary text, or solid citrus for emphasis */
  blue: "bg-clara-tint text-clara-primary ring-1 ring-inset ring-clara-primary/15",
};

export default function Badge({
  variant = "grey",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
