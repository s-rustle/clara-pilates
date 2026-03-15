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
    "bg-clara-primary text-white hover:bg-clara-accent focus:ring-2 focus:ring-clara-primary focus:ring-offset-2",
  secondary:
    "bg-clara-surface text-clara-deep hover:bg-clara-highlight focus:ring-2 focus:ring-clara-strong focus:ring-offset-2",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-2 focus:ring-red-600 focus:ring-offset-2",
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
        "inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition-colors",
        variantStyles[variant],
        disabled && "cursor-not-allowed pointer-events-none opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}
