import { clsx } from "clsx";

type BadgeVariant = "green" | "yellow" | "red" | "grey" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-clara-primary text-white",
  yellow: "bg-clara-highlight text-clara-deep",
  red: "bg-clara-accent text-white",
  grey: "border border-clara-highlight bg-clara-bg text-clara-deep",
  blue: "bg-clara-rock text-white",
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
