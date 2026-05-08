import { useScenarios } from "@/features/scenarios";
import { useDataSourceStore } from "@/stores/data-source";
import { useSelectionStore } from "@/stores/selection";
import { scriptFor } from "../lib/scripts";
import { useWalkthroughStore } from "../store";

/**
 * Walkthrough popup. Visible only while the driver is "held" on a
 * stop — i.e. the scenario is paused, the camera has flown to the
 * stop's focus, and we are waiting on the operator to advance.
 *
 * Click ▶ → unpause + advance to the next stop.
 * Click ⟲ → reset walkthrough back to stop 1 + restart scenario.
 * Click ⤽ → unpause + leave walkthrough (mode → full).
 */
export const WalkthroughOverlay = () => {
  const source = useDataSourceStore((s) => s.source);
  const { list, setPaused, restart } = useScenarios();
  const heldOnStopIdx = useWalkthroughStore((s) => s.heldOnStopIdx);
  const setHeld = useWalkthroughStore((s) => s.setHeldOnStopIdx);
  const setNext = useWalkthroughStore((s) => s.setNextStopIdx);
  const setMode = useWalkthroughStore((s) => s.setMode);
  const resetForScenario = useWalkthroughStore((s) => s.resetForScenario);
  const mode = useWalkthroughStore((s) => s.mode);

  if (source !== "live") return null;
  if (mode !== "walkthrough") return null;
  if (heldOnStopIdx === null) return null;
  if (!list) return null;

  const stops = scriptFor(list.active);
  const stop = stops[heldOnStopIdx];
  if (!stop) return null;

  const total = stops.length;
  const isLast = heldOnStopIdx === total - 1;

  const advance = () => {
    setNext(heldOnStopIdx + 1);
    setHeld(null);
    setPaused(false);
  };

  const reset = () => {
    // Drop selection first so the detail/AI panels collapse before the
    // scenario rewinds — otherwise the AI panel briefly renders against
    // a stale uid while frame 0 reseeds the events.
    useSelectionStore.getState().deselect();
    resetForScenario();
    setHeld(null);
    setPaused(false);
    void restart();
  };

  const exit = () => {
    setMode("full");
    setHeld(null);
    setPaused(false);
  };

  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-30 w-[460px] -translate-x-1/2 border border-white/40 bg-black/90 p-3 text-white shadow-[0_0_24px_rgba(0,0,0,0.8)]">
      <div className="flex items-baseline justify-between gap-2 border-b border-white/20 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {stop.title}
        </span>
        <span className="border border-terminal-accent/70 bg-terminal-accent/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-widest text-terminal-accent">
          {heldOnStopIdx + 1} / {total}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/95">
        {stop.body}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 border border-terminal-accent/60 px-2 py-0.5 text-[9px] uppercase tracking-widest text-terminal-accent hover:bg-terminal-accent/15"
            title="Restart this walkthrough from stop 1"
          >
            <span className="text-[11px] leading-none">⟲</span> reset
          </button>
          <button
            type="button"
            onClick={exit}
            className="border border-white/30 px-2 py-0.5 text-[9px] uppercase tracking-widest text-white/70 hover:bg-white/10"
          >
            play full scene
          </button>
        </div>
        <button
          type="button"
          onClick={advance}
          className="flex items-center gap-1 border border-white bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-black hover:bg-white/85"
        >
          {isLast ? "finish" : "continue"} <span className="text-base leading-none">▶</span>
        </button>
      </div>
    </div>
  );
};
