import { Panel } from "@/components/ui/panel";
import type { LinkStatus } from "@/types/cot";
import type { StatusCounts } from "../lib/aggregate";

type StatusSummaryProps = {
  counts: StatusCounts;
  total: number;
  delayed: number;
};

const ORDER: { key: LinkStatus; label: string; bar: string; text: string }[] = [
  { key: "healthy", label: "Healthy", bar: "bg-terminal-green", text: "text-terminal-green" },
  { key: "degraded", label: "Degraded", bar: "bg-terminal-yellow", text: "text-terminal-yellow" },
  { key: "critical", label: "Critical", bar: "bg-terminal-hot", text: "text-terminal-hot" },
  { key: "offline", label: "Offline", bar: "bg-terminal-gray", text: "text-terminal-gray" },
];

export const StatusSummary = ({ counts, total, delayed }: StatusSummaryProps) => {
  const delayedPct = total === 0 ? 0 : (delayed / total) * 100;
  return (
    <Panel title="Link Status" hint={`${total} total`}>
      <ul className="space-y-1">
        {ORDER.map(({ key, label, bar, text }) => {
          const n = counts[key];
          const pct = total === 0 ? 0 : (n / total) * 100;
          return (
            <li key={key} className="text-[11px]">
              <div className="flex items-baseline justify-between">
                <span className={text}>{label}</span>
                <span className="stat">
                  {n.toString().padStart(3, "0")}{" "}
                  <span className="text-terminal-dim">
                    {pct.toFixed(0).padStart(2, " ")}%
                  </span>
                </span>
              </div>
              <div className="mt-0.5 h-1 bg-terminal-border/60">
                <div
                  className={`h-full ${bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-terminal-border/50 pt-1.5 text-[11px]">
        <div className="flex items-baseline justify-between">
          <span className="text-terminal-amber">Delayed</span>
          <span className="stat">
            {delayed.toString().padStart(3, "0")}{" "}
            <span className="text-terminal-dim">
              {delayedPct.toFixed(0).padStart(2, " ")}%
            </span>
          </span>
        </div>
        <div className="mt-0.5 h-1 bg-terminal-border/60">
          <div
            className="h-full bg-terminal-amber"
            style={{ width: `${delayedPct}%` }}
          />
        </div>
      </div>
    </Panel>
  );
};
