import { useMemo } from "react";
import type { CotEvent } from "@/types/cot";
import type { RecommenderOption } from "../store";
import { recommendForLink } from "../lib/fake-recommender";

const probColor = (p: number): string => {
  if (p >= 0.7) return "var(--color-terminal-green, #00ff88)";
  if (p >= 0.4) return "var(--color-terminal-yellow, #ffd700)";
  return "var(--color-terminal-hot, #ff6b35)";
};

const ProbBar = ({ p }: { p: number }) => (
  <div className="relative h-2 w-full bg-terminal-border/60">
    <div
      className="absolute inset-y-0 left-0"
      style={{ width: `${Math.round(p * 100)}%`, background: probColor(p) }}
    />
  </div>
);

const OptionRow = ({
  opt,
  idx,
}: {
  opt: RecommenderOption;
  idx: number;
}) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-bold leading-tight text-terminal-fg">
        {idx + 1}. {opt.action}
      </span>
      <span
        className="text-[14px] tabular-nums shrink-0 font-bold"
        style={{ color: probColor(opt.successProb) }}
      >
        {Math.round(opt.successProb * 100)}%
      </span>
    </div>
    <ProbBar p={opt.successProb} />
  </div>
);

type Props = {
  /** Currently-selected track. Panel renders only when this is non-null. */
  track: CotEvent | null;
};

/**
 * Floating AI recommender panel. Sits to the LEFT of the link detail
 * panel; renders only when a track is selected. Three ranked actions
 * with success probabilities computed live from the trust score and
 * fingerprint (see lib/fake-recommender.ts) — no rationales, no
 * summary, just the verbs and the bars.
 */
export const AiRecommenderPanel = ({ track }: Props) => {
  const result = useMemo(
    () => (track ? recommendForLink(track) : null),
    [track],
  );

  if (!track || !result) return null;

  return (
    <aside className="pointer-events-auto absolute top-8 right-48 z-30 flex w-64 flex-col">
      <div className="panel-hot relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-terminal-accent/80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-terminal-accent/40" />

        <header className="flex items-center justify-between border-b border-terminal-accent/40 px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-terminal-accent" />
            <span className="label text-terminal-accent text-[11px]">
              AI RECOMMENDER
            </span>
          </div>
          <span className="text-[11px] font-bold tracking-wider text-terminal-fg">
            {result.rec.callsign}
          </span>
        </header>

        <div className="space-y-3 px-2.5 py-2.5">
          {result.rec.options.map((opt, i) => (
            <OptionRow key={`${result.rec.callsign}-${i}`} opt={opt} idx={i} />
          ))}
        </div>
      </div>
    </aside>
  );
};
