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
    "bg-clara-primary text-white shadow-clara-soft hover:bg-clara-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-accent",
  secondary:
    "border border-clara-border bg-clara-surface text-clara-deep shadow-sm hover:bg-clara-bg hover:border-clara-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-primary/35",
  destructive:
    "bg-clara-deep text-white hover:bg-clara-deep/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-accent/60",
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
    "inline-flex cursor-pointer items-center justify-center rounded-clara px-4 py-2 text-sm font-medium no-underline transition-colors",
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
