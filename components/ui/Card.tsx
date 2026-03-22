import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-clara-border bg-clara-surface p-5 shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}
