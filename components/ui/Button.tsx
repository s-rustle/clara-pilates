import Link from "next/link";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "ghost" | "accent";

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

const baseBtn =
  "inline-flex cursor-pointer items-center justify-center rounded-none border border-transparent px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] no-underline transition-colors";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-clara-primary text-white hover:bg-clara-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-primary",
  ghost:
    "border border-clara-primary bg-white text-clara-primary hover:bg-clara-tint/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-primary",
  accent:
    "bg-clara-accent text-clara-deep hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-deep",
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
    baseBtn,
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
