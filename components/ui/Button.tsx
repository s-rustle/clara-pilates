import Link from "next/link";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "destructive";

interface ButtonProps {
  variant?: ButtonVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  /** When set, renders as a Next.js link (navigation) instead of a button. */
  href?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-clara-primary text-white hover:bg-clara-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-rock",
  secondary:
    "border border-clara-highlight bg-clara-bg text-clara-deep hover:bg-clara-highlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-accent/50",
  destructive:
    "bg-clara-rock text-white hover:bg-clara-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-deep",
};

export default function Button({
  variant = "primary",
  children,
  onClick,
  disabled = false,
  className,
  type = "button",
  href,
}: ButtonProps) {
  const classes = clsx(
    "inline-flex cursor-pointer items-center justify-center rounded-sm px-4 py-2 text-sm font-medium no-underline transition-colors",
    variantStyles[variant],
    disabled && "pointer-events-none cursor-not-allowed opacity-50",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
