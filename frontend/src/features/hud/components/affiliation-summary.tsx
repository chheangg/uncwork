import { Panel } from "@/components/ui/panel";
import type { Affiliation } from "@/types/cot";
import type { AffiliationCounts } from "../lib/aggregate";

type AffiliationSummaryProps = {
  counts: AffiliationCounts;
};

const ORDER: { key: Affiliation; label: string; dot: string }[] = [
  { key: "friendly", label: "Friendly", dot: "bg-terminal-blue" },
  { key: "hostile", label: "Hostile", dot: "bg-terminal-hot" },
  { key: "neutral", label: "Neutral", dot: "bg-terminal-green" },
  { key: "unknown", label: "Unknown", dot: "bg-terminal-yellow" },
  { key: "pending", label: "Pending", dot: "bg-terminal-amber" },
  { key: "assumed", label: "Assumed", dot: "bg-purple-400" },
  { key: "suspect", label: "Suspect", dot: "bg-pink-400" },
];

export const AffiliationSummary = ({ counts }: AffiliationSummaryProps) => (
  <Panel title="Affiliation">
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
      {ORDER.map(({ key, label, dot }) => (
        <li key={key} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 ${dot}`} />
            <span className="text-terminal-dim">{label}</span>
          </span>
          <span className="stat">
            {counts[key].toString().padStart(3, "0")}
          </span>
        </li>
      ))}
    </ul>
  </Panel>
);
