import { clsx } from "clsx";

type BadgeVariant = "green" | "yellow" | "red" | "grey" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

/** Good / neutral emphasis: tint + primary text. Yellow: neutral bordered (no accent). Red: weak / low. */
const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-clara-tint text-clara-primary",
  yellow: "border border-clara-border bg-white text-clara-deep",
  red: "bg-clara-danger-bg text-clara-danger",
  grey: "border border-clara-border bg-white text-clara-deep",
  blue: "bg-clara-tint text-clara-primary",
};

export default function Badge({
  variant = "grey",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-none px-[10px] py-[2px] text-xs font-medium leading-tight",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
