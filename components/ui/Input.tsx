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
        <label className="mb-1 block text-sm font-medium text-clara-deep">
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full rounded-lg border border-clara-highlight bg-clara-surface px-3 py-2 text-clara-deep placeholder:text-clara-deep/60 focus:border-clara-strong focus:outline-none focus:ring-1 focus:ring-clara-strong disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
