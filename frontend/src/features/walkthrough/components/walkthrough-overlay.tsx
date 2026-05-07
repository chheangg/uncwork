import { useScenarios } from "@/features/scenarios";
import { scriptFor } from "../lib/scripts";
import { useWalkthroughStore } from "../store";

/**
 * Walkthrough popup. Visible only while the driver is "held" on a
 * stop — i.e. the scenario is paused, the camera has flown to the
 * stop's focus, and we are waiting on the operator to advance.
 *
 * Click ▶ → unpause + advance to the next stop.
 * Click ⤽ → unpause + leave walkthrough (mode → full).
 */
export const WalkthroughOverlay = () => {
  const { list, setPaused } = useScenarios();
  const heldOnStopIdx = useWalkthroughStore((s) => s.heldOnStopIdx);
  const setHeld = useWalkthroughStore((s) => s.setHeldOnStopIdx);
  const setNext = useWalkthroughStore((s) => s.setNextStopIdx);
  const setMode = useWalkthroughStore((s) => s.setMode);
  const mode = useWalkthroughStore((s) => s.mode);

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
        <span className="text-[9px] tabular-nums text-white/60">
          {heldOnStopIdx + 1} / {total}
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-white/95">
        {stop.body}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={exit}
          className="border border-white/30 px-2 py-0.5 text-[9px] uppercase tracking-widest text-white/70 hover:bg-white/10"
        >
          play full scene
        </button>
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
