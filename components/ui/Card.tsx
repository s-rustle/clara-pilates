import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-clara border border-clara-border/90 bg-clara-surface p-5 shadow-clara-soft",
        className
      )}
    >
      {children}
    </div>
  );
}
