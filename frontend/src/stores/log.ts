import { create } from "zustand";
import type { Dimension, SensorType } from "@/types/cot";

export type LogEntryKind =
  | "system"
  | "operator"
  | "recommendation"
  | "recommendation-action"
  | "status"
  | "delivery"
  | "track";

export type LogEntry = {
  id: string;
  ts: number;
  kind: LogEntryKind;
  uid?: string;
  summary: string;
  payload?: Record<string, unknown>;
  dimension?: Dimension;
  sensorType?: SensorType;
};

type LogStore = {
  entries: LogEntry[];
  append: (entry: Omit<LogEntry, "id" | "ts"> & { ts?: number }) => void;
  clear: () => void;
};

const MAX_ENTRIES = 500;

let counter = 0;
const nextId = (): string =>
  `log-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export const useLogStore = create<LogStore>((set) => ({
  entries: [],
  append: (entry) =>
    set((state) => {
      const next: LogEntry = {
        id: nextId(),
        ts: entry.ts ?? Date.now(),
        kind: entry.kind,
        uid: entry.uid,
        summary: entry.summary,
        payload: entry.payload,
        dimension: entry.dimension,
        sensorType: entry.sensorType,
      };
      const list = [...state.entries, next];
      if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES);
      return { entries: list };
    }),
  clear: () => set({ entries: [] }),
}));

export const selectLogEntries = (s: LogStore) => s.entries;
