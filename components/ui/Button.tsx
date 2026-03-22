import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "destructive";

interface ButtonProps {
  variant?: ButtonVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-clara-primary text-white hover:bg-clara-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-primary",
  secondary:
    "border border-clara-border bg-clara-surface text-clara-ink shadow-sm hover:bg-clara-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-warm/50",
  destructive:
    "bg-[#8F3D32] text-white hover:bg-[#7A3329] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F3D32]",
};

export default function Button({
  variant = "primary",
  children,
  onClick,
  disabled = false,
  className,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors",
        variantStyles[variant],
        disabled && "pointer-events-none cursor-not-allowed opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}
