import { clsx } from "clsx";

type BadgeVariant = "green" | "yellow" | "red" | "grey" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: "bg-clara-primary text-white",
  yellow: "bg-amber-400 text-amber-950",
  red: "bg-red-600 text-white",
  grey: "bg-gray-400 text-gray-900",
  blue: "bg-blue-500 text-white",
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
