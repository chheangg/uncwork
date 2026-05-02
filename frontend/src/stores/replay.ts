import { create } from "zustand";

export type ReplayMode = "live" | "replay";
export type PlaybackSpeed = 1 | 10 | 100;

type ReplayState = {
  mode: ReplayMode;
  playing: boolean;
  speed: PlaybackSpeed;
  playhead: number; // Unix timestamp in seconds
  startTime: number | null;
  endTime: number | null;
};

type ReplayActions = {
  setMode: (mode: ReplayMode) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  setPlayhead: (time: number) => void;
  jumpTo: (time: number) => void;
  setTimeRange: (start: number, end: number) => void;
  reset: () => void;
};

const initialState: ReplayState = {
  mode: "live",
  playing: false,
  speed: 1,
  playhead: Date.now() / 1000,
  startTime: null,
  endTime: null,
};

export const useReplayStore = create<ReplayState & ReplayActions>((set) => ({
  ...initialState,

  setMode: (mode) =>
    set((s) => ({
      mode,
      playing: mode === "live" ? false : s.playing,
      playhead: mode === "live" ? Date.now() / 1000 : s.playhead,
    })),

  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),

  setSpeed: (speed) => set({ speed }),

  setPlayhead: (playhead) => set({ playhead }),

  jumpTo: (time) =>
    set((s) => ({
      playhead: Math.max(
        s.startTime ?? time,
        Math.min(s.endTime ?? time, time),
      ),
    })),

  setTimeRange: (startTime, endTime) =>
    set((s) => ({
      startTime,
      endTime,
      playhead:
        s.mode === "replay"
          ? Math.max(startTime, Math.min(endTime, s.playhead))
          : s.playhead,
    })),

  reset: () => set(initialState),
}));
