import { useScenarios } from "@/features/scenarios";
import { useDataSourceStore } from "@/stores/data-source";
import { useEventStore } from "@/stores/events";
import { useSelectionStore } from "@/stores/selection";
import { scriptFor } from "../lib/scripts";
import { useWalkthroughStore } from "../store";

/**
 * Post-walkthrough banner. Renders only when the operator is in
 * walkthrough mode, the script has run past its last stop, and no
 * popup is currently held. Gives a clear "what now" affordance —
 * REPLAY (back to stop 1, scenario rewinds) or EXIT (drop to full
 * mode, scenario keeps running).
 */
export const WalkthroughComplete = () => {
  const source = useDataSourceStore((s) => s.source);
  const setSource = useDataSourceStore((s) => s.setSource);
  const { list, setPaused, restart } = useScenarios();
  const mode = useWalkthroughStore((s) => s.mode);
  const nextStopIdx = useWalkthroughStore((s) => s.nextStopIdx);
  const heldOnStopIdx = useWalkthroughStore((s) => s.heldOnStopIdx);
  const setMode = useWalkthroughStore((s) => s.setMode);
  const setHeld = useWalkthroughStore((s) => s.setHeldOnStopIdx);
  const resetForScenario = useWalkthroughStore((s) => s.resetForScenario);

  if (source !== "live") return null;
  if (mode !== "walkthrough") return null;
  if (heldOnStopIdx !== null) return null;
  if (!list) return null;

  const total = scriptFor(list.active).length;
  if (total === 0) return null;
  if (nextStopIdx < total) return null;

  const replay = () => {
    useSelectionStore.getState().deselect();
    resetForScenario();
    setHeld(null);
    setPaused(false);
    void restart();
  };

  const exit = () => {
    useSelectionStore.getState().deselect();
    setMode("full");
    setHeld(null);
    setPaused(false);
  };

  const tryBattle = () => {
    useSelectionStore.getState().deselect();
    useEventStore.getState().clear();
    resetForScenario();
    setHeld(null);
    setMode("full");
    setPaused(false);
    setSource("battle");
  };

  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-30 w-[420px] -translate-x-1/2 border border-terminal-accent/70 bg-black/90 p-3 text-white shadow-[0_0_24px_rgba(0,217,255,0.25)]">
      <div className="flex items-baseline justify-between gap-2 border-b border-terminal-accent/40 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-terminal-accent">
          walkthrough complete
        </span>
        <span className="border border-terminal-accent/70 bg-terminal-accent/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-widest text-terminal-accent">
          {total} / {total}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/95">
        That's the surface end-to-end. Replay the walkthrough, watch
        the scenario play through without auto-pauses, or jump into
        the free-form BATTLE simulation to see the same surface on
        units that move and fight on their own.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={tryBattle}
          className="flex items-center justify-center gap-1.5 border border-terminal-hot bg-terminal-hot/20 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-terminal-hot hover:bg-terminal-hot/30"
        >
          <span className="text-base leading-none">▶</span> try battle simulation
        </button>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={exit}
            className="border border-white/30 px-2 py-0.5 text-[9px] uppercase tracking-widest text-white/70 hover:bg-white/10"
          >
            play full scene
          </button>
          <button
            type="button"
            onClick={replay}
            className="flex items-center gap-1.5 border border-terminal-accent bg-terminal-accent/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-terminal-accent hover:bg-terminal-accent/25"
          >
            <span className="text-sm leading-none">⟲</span> replay
          </button>
        </div>
      </div>
    </div>
  );
};
