import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type PanelProps = {
  title?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

export const Panel = ({ title, hint, className, children }: PanelProps) => (
  <div className={cn("panel p-2 text-[9px]", className)}>
    {(title ?? hint) && (
      <header className="flex items-baseline justify-between mb-1 gap-2">
        {title && (
          <span className="label text-terminal-accent">{title}</span>
        )}
        {hint && <span className="label">{hint}</span>}
      </header>
    )}
    {children}
  </div>
);
