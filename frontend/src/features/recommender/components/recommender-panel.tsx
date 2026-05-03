import { useState } from "react";
import { useLogStore } from "@/stores/log";
import {
  ACTION_LABEL,
  type Recommendation,
  type RecommendationAction,
} from "../lib/mock-stream";

type Props = {
  rec: Recommendation | null;
};

const ACTION_TONE: Record<RecommendationAction, string> = {
  engage: "text-terminal-hot",
  intercept: "text-terminal-hot",
  suppress: "text-terminal-amber",
  hold: "text-terminal-yellow",
  reroute: "text-terminal-yellow",
  verify: "text-terminal-blue",
  handoff: "text-terminal-blue",
  reacquire: "text-terminal-amber",
  observe: "text-terminal-green",
  monitor: "text-terminal-green",
};

const ACTION_BAR: Record<RecommendationAction, string> = {
  engage: "bg-terminal-hot",
  intercept: "bg-terminal-hot",
  suppress: "bg-terminal-amber",
  hold: "bg-terminal-yellow",
  reroute: "bg-terminal-yellow",
  verify: "bg-terminal-blue",
  handoff: "bg-terminal-blue",
  reacquire: "bg-terminal-amber",
  observe: "bg-terminal-green",
  monitor: "bg-terminal-green",
};

export const RecommenderPanel = ({ rec }: Props) => {
  const append = useLogStore((s) => s.append);
  const [chosen, setChosen] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!rec) return null;

  const isResolved = chosen === rec.id || dismissed === rec.id;

  const onAction = (action: RecommendationAction, probability: number) => {
    setChosen(rec.id);
    append({
      kind: "recommendation-action",
      uid: rec.uid,
      summary: `Operator ${ACTION_LABEL[action]} (${(probability * 100).toFixed(0)}%)`,
      payload: { recId: rec.id, action, probability },
    });
  };

  const onDismiss = () => {
    setDismissed(rec.id);
    append({
      kind: "recommendation-action",
      uid: rec.uid,
      summary: "Operator DISMISSED recommendation",
      payload: { recId: rec.id },
    });
  };

  return (
    <aside className="pointer-events-auto absolute top-8 right-[192px] z-30 flex w-45 flex-col">
      <div className="panel-hot relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-terminal-accent/80" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-terminal-accent/40" />

        <header className="flex items-center justify-between border-b border-terminal-accent/40 px-2 py-1 h-6">
          <div className="flex items-center gap-1.5">
            <span
              className={`block h-1.5 w-1.5 rounded-full ${
                rec.complete
                  ? "bg-terminal-green"
                  : "animate-pulse bg-terminal-accent"
              }`}
            />
            <span className="label text-terminal-accent text-[9px]">AI</span>
          </div>
          <span className="label text-terminal-dim text-[8px]">
            {rec.complete ? "RDY" : "STR"}
          </span>
        </header>

        <div className="space-y-1.5 px-2 py-1.5 text-[9px]">
          <div>
            <div className="label text-[8px] mb-1">ACT</div>
            <ul className="space-y-0.5">
              {rec.options.map((opt, idx) => {
                const isPrimary = idx === 0;
                const pct = Math.round(opt.probability * 100);
                const tone = ACTION_TONE[opt.action];
                const bar = ACTION_BAR[opt.action];
                return (
                  <li key={opt.action}>
                    <button
                      type="button"
                      disabled={isResolved}
                      onClick={() => onAction(opt.action, opt.probability)}
                      className={`group relative w-full overflow-hidden border px-1.5 py-1 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        isPrimary
                          ? "border-terminal-accent/80 bg-terminal-accent/10"
                          : "border-terminal-border hover:border-terminal-fg/40 hover:bg-terminal-fg/5"
                      }`}
                    >
                      <div
                        aria-hidden
                        className={`absolute inset-y-0 left-0 ${bar} opacity-20`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between gap-1">
                        <span
                          className={`stat tracking-widest ${tone} text-[9px] font-bold uppercase`}
                        >
                          {isPrimary ? "►" : " "}{ACTION_LABEL[opt.action].slice(0, 6)}
                        </span>
                        <span
                          className={`tabular-nums text-[8px] ${
                            isPrimary
                              ? "text-terminal-accent font-bold"
                              : "text-terminal-dim"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <div className="label text-[8px]">WHY</div>
            <div className="leading-tight text-terminal-fg/90 min-h-[48px] text-[8px]">
              {rec.rationale}
              {!rec.complete && (
                <span className="ml-0.5 inline-block animate-blink text-terminal-accent">
                  ▮
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-terminal-border/60 pt-1">
            <button
              type="button"
              disabled={isResolved}
              onClick={onDismiss}
              className="border border-terminal-border bg-terminal-panel/80 px-1.5 py-0.5 text-[9px] tracking-widest text-terminal-dim hover:border-terminal-fg/50 hover:text-terminal-fg disabled:cursor-not-allowed disabled:hover:border-terminal-border disabled:hover:text-terminal-dim font-bold"
            >
              [X]
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
