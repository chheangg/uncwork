import { Panel } from "@/components/ui/panel";
import type { LinkStatus } from "@/types/cot";
import type { StatusCounts } from "../lib/aggregate";

type StatusSummaryProps = {
  counts: StatusCounts;
  total: number;
  delayed: number;
};

const ORDER: { key: LinkStatus; label: string; bar: string; text: string }[] = [
  { key: "healthy", label: "OK", bar: "bg-terminal-green", text: "text-terminal-green" },
  { key: "degraded", label: "DEG", bar: "bg-terminal-yellow", text: "text-terminal-yellow" },
  { key: "critical", label: "CRT", bar: "bg-terminal-hot", text: "text-terminal-hot" },
  { key: "offline", label: "OFF", bar: "bg-terminal-gray", text: "text-terminal-gray" },
];

export const StatusSummary = ({ counts, total, delayed }: StatusSummaryProps) => {
  const delayedPct = total === 0 ? 0 : (delayed / total) * 100;
  return (
    <Panel title="LNK STA" hint={`${total}`}>
      <ul className="space-y-0.5">
        {ORDER.map(({ key, label, text }) => {
          const n = counts[key];
          const pct = total === 0 ? 0 : (n / total) * 100;
          const barWidth = Math.round(pct / 10);
          const barStr = "█".repeat(barWidth) + "░".repeat(10 - barWidth);
          return (
            <li key={key} className="text-[9px] leading-tight">
              <div className="flex items-baseline justify-between gap-1">
                <span className={`${text} font-bold tracking-widest w-8`}>{label}</span>
                <span className="stat text-[9px] tabular-nums flex-1 text-right">
                  {n.toString().padStart(3, "0")}
                </span>
                <span className="text-terminal-dim text-[9px] tabular-nums w-8 text-right">
                  {pct.toFixed(0)}%
                </span>
                <span className={`${text} text-[9px] font-mono tracking-tighter`}>
                  {barStr}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 border-t border-terminal-border/50 pt-1 text-[9px]">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-terminal-amber font-bold tracking-widest w-8">DLY</span>
          <span className="stat text-[9px] tabular-nums flex-1 text-right">
            {delayed.toString().padStart(3, "0")}
          </span>
          <span className="text-terminal-dim text-[9px] tabular-nums w-8 text-right">
            {delayedPct.toFixed(0)}%
          </span>
          <span className="text-terminal-amber text-[9px] font-mono tracking-tighter">
            {"█".repeat(Math.round(delayedPct / 10)) + "░".repeat(10 - Math.round(delayedPct / 10))}
          </span>
        </div>
      </div>
    </Panel>
  );
};
