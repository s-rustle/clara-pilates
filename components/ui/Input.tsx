import { clsx } from "clsx";

interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  disabled?: boolean;
  className?: string;
}

export default function Input({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  disabled = false,
  className,
}: InputProps) {
  return (
    <div className={clsx("w-full", className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-clara-deep">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-md border border-clara-border bg-clara-elevated px-3 py-2 text-sm text-clara-ink placeholder:text-clara-muted/80 focus:border-clara-warm focus:outline-none focus:ring-1 focus:ring-clara-warm/40 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
