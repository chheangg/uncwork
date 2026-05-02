import { create } from "zustand";
import type { CotEvent } from "@/types/cot";

type EventStore = {
  events: Record<string, CotEvent>;
  upsertMany: (incoming: CotEvent[]) => void;
  remove: (uid: string) => void;
  clear: () => void;
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
}));

export const selectEventList = (state: EventStore) =>
  Object.values(state.events);
