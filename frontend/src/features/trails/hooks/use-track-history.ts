import { useMemo } from "react";
import { selectEventList, useEventStore } from "@/stores/events";
import type { LinkStatus } from "@/types/cot";

export type TrackPath = {
  uid: string;
  path: [number, number, number][];
  timestamps: number[];
  status: LinkStatus;
};

const RETAIN_S = 36;
const STALE_REMOVE_S = 42;

type HistoryEntry = {
  path: [number, number, number][];
  timestamps: number[];
  status: LinkStatus;
  lastUpdated: number;
};

const HISTORY = new Map<string, HistoryEntry>();

export const useTrackHistory = (): TrackPath[] => {
  const events = useEventStore(selectEventList);

  return useMemo(() => {
    if (events.length === 0) {
      HISTORY.clear();
      return [];
    }

    const t = Date.now() / 1000;

    for (const e of events) {
      const point: [number, number, number] = [e.lon, e.lat, 0];
      const existing = HISTORY.get(e.uid);
      if (!existing) {
        HISTORY.set(e.uid, {
          path: [point],
          timestamps: [t],
          status: e.status,
          lastUpdated: t,
        });
        continue;
      }
      existing.path.push(point);
      existing.timestamps.push(t);
      const cutoff = t - RETAIN_S;
      while (
        existing.timestamps.length > 1 &&
        existing.timestamps[0]! < cutoff
      ) {
        existing.path.shift();
        existing.timestamps.shift();
      }
      existing.status = e.status;
      existing.lastUpdated = t;
    }

    for (const [uid, h] of HISTORY) {
      if (h.lastUpdated < t - STALE_REMOVE_S) HISTORY.delete(uid);
    }

    const out: TrackPath[] = [];
    for (const [uid, h] of HISTORY) {
      if (h.path.length < 2) continue;
      out.push({
        uid,
        path: h.path.slice(),
        timestamps: h.timestamps.slice(),
        status: h.status,
      });
    }
    return out;
  }, [events]);
};
