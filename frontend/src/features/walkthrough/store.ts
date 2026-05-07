import { create } from "zustand";

export type PlaybackMode = "full" | "walkthrough";

type WalkthroughStore = {
  mode: PlaybackMode;
  // Index of the next stop to fire (or stops.length when finished).
  nextStopIdx: number;
  // Whether a stop is currently held (popup visible, scenario paused).
  heldOnStopIdx: number | null;
  // Wall-clock-derived elapsed scenario seconds (excludes paused time).
  elapsedSec: number;
  setMode: (mode: PlaybackMode) => void;
  setNextStopIdx: (idx: number) => void;
  setHeldOnStopIdx: (idx: number | null) => void;
  addElapsed: (delta: number) => void;
  resetForScenario: () => void;
};

export const useWalkthroughStore = create<WalkthroughStore>((set) => ({
  // Default to "walkthrough" so first-time visitors see the guided
  // narrative. The driver pairs this with a one-shot restart on the
  // first /scenarios fetch so the scenario rewinds to frame 0 before
  // stop 1 fires (otherwise the popup would land on whatever mid-loop
  // state happened to be on the wire).
  mode: "walkthrough",
  nextStopIdx: 0,
  heldOnStopIdx: null,
  elapsedSec: 0,
  setMode: (mode) => set({ mode }),
  setNextStopIdx: (nextStopIdx) => set({ nextStopIdx }),
  setHeldOnStopIdx: (heldOnStopIdx) => set({ heldOnStopIdx }),
  addElapsed: (delta) => set((s) => ({ elapsedSec: s.elapsedSec + delta })),
  resetForScenario: () =>
    set({ nextStopIdx: 0, heldOnStopIdx: null, elapsedSec: 0 }),
}));
