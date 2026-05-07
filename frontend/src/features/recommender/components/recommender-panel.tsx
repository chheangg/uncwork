import { Panel } from "@/components/ui/panel";
import { useEventStore, selectEventList } from "@/stores/events";
import { useScenarios } from "@/features/scenarios";
import { useRecommenderStore, type RecommenderOption } from "../store";
import { requestRecommendation } from "../lib/api";

const probColor = (p: number): string => {
  if (p >= 0.7) return "var(--color-terminal-green, #00ff88)";
  if (p >= 0.4) return "var(--color-terminal-yellow, #ffd700)";
  return "var(--color-terminal-hot, #ff6b35)";
};

const ProbBar = ({ p }: { p: number }) => (
  <div className="relative h-1 w-full bg-terminal-panel2">
    <div
      className="absolute inset-y-0 left-0"
      style={{ width: `${Math.round(p * 100)}%`, background: probColor(p) }}
    />
  </div>
);

const OptionRow = ({ opt, idx }: { opt: RecommenderOption; idx: number }) => (
  <div className="space-y-0.5 border-l-2 pl-1.5" style={{ borderColor: probColor(opt.successProb) }}>
    <div className="flex items-baseline justify-between gap-2 text-[10px]">
      <span className="font-bold text-terminal-fg">
        {idx + 1}. {opt.action}
      </span>
      <span
        className="tabular-nums"
        style={{ color: probColor(opt.successProb) }}
      >
        {Math.round(opt.successProb * 100)}%
      </span>
    </div>
    <ProbBar p={opt.successProb} />
    <div className="text-[9px] leading-snug text-terminal-dim">
      {opt.rationale}
    </div>
  </div>
);

export const RecommenderPanel = () => {
  const loading = useRecommenderStore((s) => s.loading);
  const setLoading = useRecommenderStore((s) => s.setLoading);
  const result = useRecommenderStore((s) => s.result);
  const setResult = useRecommenderStore((s) => s.setResult);
  const error = useRecommenderStore((s) => s.error);
  const setError = useRecommenderStore((s) => s.setError);

  const events = useEventStore(selectEventList);
  const { list } = useScenarios();
  const scenario = list?.active ?? "unknown";

  const ask = async () => {
    if (events.length === 0) {
      setError("no live tracks to analyze");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { links, summary } = await requestRecommendation({
        scenario,
        events,
      });
      setResult({
        links,
        summary,
        receivedAtMs: Date.now(),
        scenario,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const stale = result !== null && result.scenario !== scenario;

  return (
    <Panel title="AI RECOMMENDER" hint="GEMINI">
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={ask}
          disabled={loading}
          className="w-full border border-terminal-accent bg-terminal-accent/10 px-1.5 py-1 text-[10px] font-bold uppercase tracking-widest text-terminal-accent hover:bg-terminal-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "thinking…" : "ask gemini"}
        </button>

        {error && (
          <div className="text-[9px] leading-snug text-terminal-hot">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-1.5 border-t border-terminal-border/50 pt-1.5">
            <div className="flex items-baseline justify-between text-[8px] uppercase tracking-widest">
              <span className="text-terminal-dim">recommendation</span>
              <span className="text-terminal-dim">
                {stale ? `stale · ${result.scenario}` : result.scenario}
              </span>
            </div>

            {result.summary && (
              <div className="text-[10px] leading-snug text-terminal-fg">
                {result.summary}
              </div>
            )}

            {result.links.length === 0 ? (
              <div className="text-[9px] text-terminal-dim italic">
                Nothing requires attention right now.
              </div>
            ) : (
              <div className="space-y-2">
                {result.links.map((link) => (
                  <div key={link.callsign} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 border-b border-terminal-border/30 pb-0.5">
                      <span className="text-[10px] font-bold tracking-widest text-terminal-fg">
                        {link.callsign}
                      </span>
                      <span className="text-[8px] uppercase text-terminal-dim">
                        {link.concern}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {link.options.map((opt, i) => (
                        <OptionRow key={`${link.callsign}-${i}`} opt={opt} idx={i} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
};
