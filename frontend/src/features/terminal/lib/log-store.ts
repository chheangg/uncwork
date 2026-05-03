import { create } from "zustand";
import type { LinkStatus } from "@/types/cot";

export type LogLine = {
  id: string;
  ts: number;
  status: LinkStatus;
  callsign: string;
  lat: number;
  lon: number;
};

const MAX_LINES = 120;

type LogStore = {
  lines: LogLine[];
  append: (incoming: LogLine[]) => void;
  clear: () => void;
};

export const useLogStore = create<LogStore>((set) => ({
  lines: [],
  append: (incoming) =>
    set((s) => {
      const next = [...s.lines, ...incoming];
      return { lines: next.length > MAX_LINES ? next.slice(-MAX_LINES) : next };
    }),
  clear: () => set({ lines: [] }),
}));
