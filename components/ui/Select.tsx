import { clsx } from "clsx";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  name?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  className?: string;
}

export default function Select({
  label,
  name,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: SelectProps) {
  return (
    <div className={clsx("w-full", className)}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-clara-deep">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full appearance-none rounded-sm border border-clara-border bg-clara-bg px-3 py-2 pr-8 text-sm text-clara-deep focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-clara-muted"
          aria-hidden
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 4L6 8L10 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
