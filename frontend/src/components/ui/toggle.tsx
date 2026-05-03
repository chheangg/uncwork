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
      "px-1.5 py-0.5 text-[9px] uppercase tracking-widest border transition-colors font-bold leading-tight",
      "border-terminal-border text-terminal-dim hover:text-terminal-fg hover:border-terminal-fg/40",
      active &&
        "bg-terminal-accent/10 text-terminal-accent border-terminal-accent",
      className,
    )}
  >
    {children}
  </button>
);
