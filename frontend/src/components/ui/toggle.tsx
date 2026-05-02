import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type ToggleProps = {
  active: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  className?: string;
};

export const Toggle = ({ active, onChange, children, className }: ToggleProps) => (
  <button
    type="button"
    onClick={() => onChange(!active)}
    className={cn(
      "px-2.5 py-1 text-[11px] uppercase tracking-wider border transition-colors",
      "border-terminal-border text-terminal-dim hover:text-terminal-fg hover:border-terminal-accent/60",
      active &&
        "bg-terminal-accent/10 text-terminal-accent border-terminal-accent shadow-glow",
      className,
    )}
  >
    {children}
  </button>
);
