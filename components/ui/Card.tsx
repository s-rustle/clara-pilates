import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-sm border border-clara-highlight bg-clara-surface p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
