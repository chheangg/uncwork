import { create } from "zustand";
import type { CotEvent } from "@/types/cot";

type EventStore = {
  events: Record<string, CotEvent>;
  upsertMany: (incoming: CotEvent[]) => void;
  remove: (uid: string) => void;
  clear: () => void;
  pruneOlderThan: (cutoffMs: number) => void;
};

export const useEventStore = create<EventStore>((set) => ({
  events: {},
  upsertMany: (incoming) =>
    set((state) => {
      const next = { ...state.events };
      for (const event of incoming) next[event.uid] = event;
      return { events: next };
    }),
  remove: (uid) =>
    set((state) => {
      if (!(uid in state.events)) return state;
      const next = { ...state.events };
      delete next[uid];
      return { events: next };
    }),
  clear: () => set({ events: {} }),
  pruneOlderThan: (cutoffMs) =>
    set((state) => {
      const next: Record<string, CotEvent> = {};
      let removed = 0;
      for (const [uid, ev] of Object.entries(state.events)) {
        const t = Date.parse(ev.time);
        if (Number.isFinite(t) && t >= cutoffMs) {
          next[uid] = ev;
        } else {
          removed += 1;
        }
      }
      if (removed === 0) return state;
      return { events: next };
    }),
}));

export const selectEventList = (state: EventStore) =>
  Object.values(state.events);
