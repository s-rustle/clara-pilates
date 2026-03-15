import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-clara-highlight bg-clara-surface p-4 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
