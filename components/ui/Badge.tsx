import { clsx } from "clsx";

type BadgeVariant = "green" | "yellow" | "red" | "grey" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-clara-forest text-white",
  yellow: "bg-clara-accent/35 text-clara-strong ring-1 ring-clara-accent/25",
  red: "bg-clara-alert text-white",
  grey: "border border-clara-highlight bg-clara-bg text-clara-deep",
  blue: "bg-clara-sky text-white",
};

export default function Badge({
  variant = "green",
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
