import { clsx } from "clsx";

type BadgeVariant = "green" | "yellow" | "red" | "grey" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-clara-primary text-white",
  yellow: "bg-amber-600/90 text-amber-950",
  red: "bg-[#8F3D32] text-white",
  grey: "bg-clara-border/60 text-clara-deep",
  blue: "bg-[#5E4A42] text-white",
};

export default function Badge({
  variant = "green",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
