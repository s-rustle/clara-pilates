import { clsx } from "clsx";

interface InputProps {
  label?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}

export default function Input({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
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
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-sm border border-clara-highlight bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
