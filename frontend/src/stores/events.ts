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
      for (const event of incoming) {
        // The HEAVY_JAM chaos profile reorders frames. The listener
        // dedupes by (uid, time) but does not buffer-and-sort, so the
        // websocket can deliver an older frame after a newer one for
        // the same uid. Without this guard, the older frame would
        // overwrite the latest position — the icon snaps backward and
        // the trail appends a zigzag segment when it next polls.
        const current = next[event.uid];
        if (current) {
          const incomingT = Date.parse(event.time);
          const currentT = Date.parse(current.time);
          if (
            Number.isFinite(incomingT) &&
            Number.isFinite(currentT) &&
            incomingT < currentT
          ) {
            continue;
          }
        }
        next[event.uid] = event;
      }
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
