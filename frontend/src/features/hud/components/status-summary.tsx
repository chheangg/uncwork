import { Panel } from "@/components/ui/panel";
import type { LinkStatus } from "@/types/cot";
import type { StatusCounts } from "../lib/aggregate";

type StatusSummaryProps = {
  counts: StatusCounts;
  total: number;
  delayed: number;
  meanTrust: number;
};

const ORDER: { key: LinkStatus; label: string; bar: string; text: string }[] = [
  { key: "healthy", label: "HEALTHY", bar: "bg-terminal-green", text: "text-terminal-green" },
  { key: "degraded", label: "DEGRADED", bar: "bg-terminal-yellow", text: "text-terminal-yellow" },
  { key: "critical", label: "CRITICAL", bar: "bg-terminal-hot", text: "text-terminal-hot" },
  { key: "offline", label: "OFFLINE", bar: "bg-terminal-gray", text: "text-terminal-gray" },
];

export const StatusSummary = ({ counts, total, delayed, meanTrust }: StatusSummaryProps) => {
  const delayedPct = total === 0 ? 0 : (delayed / total) * 100;
  const trustPct = Math.round(meanTrust * 100);
  return (
    <Panel title="LINK STATUS" hint={`${total}`}>
      <ul className="space-y-0.5">
        {ORDER.map(({ key, label, text }) => {
          const n = counts[key];
          const pct = total === 0 ? 0 : (n / total) * 100;
          const barWidth = Math.round(pct / 10);
          const barStr = "█".repeat(barWidth) + "░".repeat(10 - barWidth);
          return (
            <li key={key} className="text-[9px] leading-tight">
              <div className="flex items-baseline gap-1">
                <span className={`${text} font-bold tracking-widest shrink-0 w-[64px]`}>{label}</span>
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
        <div className="flex items-baseline gap-1">
          <span className="text-terminal-amber font-bold tracking-widest shrink-0 w-[64px]">DELAYED</span>
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
        <div className="mt-1 border-t border-terminal-border/50 pt-1 flex items-baseline gap-1">
          <span className="text-terminal-dim font-bold tracking-widest shrink-0 w-[64px] text-[9px]">TRUST</span>
          <span className="stat text-[9px] tabular-nums flex-1 text-right">{trustPct}%</span>
          <span className={`text-[9px] font-mono tracking-tighter ${
            trustPct >= 60 ? "text-terminal-green" :
            trustPct >= 30 ? "text-terminal-yellow" :
            trustPct >= 8  ? "text-terminal-hot"   :
                             "text-terminal-gray"
          }`}>
            {"█".repeat(Math.round(trustPct / 10)) + "░".repeat(10 - Math.round(trustPct / 10))}
          </span>
        </div>
      </div>
    </Panel>
  );
};
