import { useMemo } from "react";
import type { CotEvent } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";

const RETAIN_S = 30;
const POSITION_EPSILON = 1e-7;

type HistoryEntry = {
  path: [number, number][];
  timestamps: number[];
  latest: CotEvent;
};

const HISTORY = new Map<string, HistoryEntry>();

export const useTrackHistory = <E extends CotEvent>(
  events: E[],
): TrackPath<E>[] =>
  useMemo(() => {
    if (events.length === 0) {
      HISTORY.clear();
      return [];
    }

    const t = Date.now() / 1000;
    const liveUids = new Set<string>();

    for (const e of events) {
      liveUids.add(e.uid);
      const point: [number, number] = [e.lon, e.lat];
      const existing = HISTORY.get(e.uid);
      if (!existing) {
        HISTORY.set(e.uid, {
          path: [point],
          timestamps: [t],
          latest: e,
        });
        continue;
      }

      const lastPoint = existing.path[existing.path.length - 1]!;
      const moved =
        Math.abs(lastPoint[0] - point[0]) > POSITION_EPSILON ||
        Math.abs(lastPoint[1] - point[1]) > POSITION_EPSILON;
      if (moved) {
        existing.path.push(point);
        existing.timestamps.push(t);
      }

      const cutoff = t - RETAIN_S;
      while (
        existing.timestamps.length > 1 &&
        existing.timestamps[0]! < cutoff
      ) {
        existing.path.shift();
        existing.timestamps.shift();
      }
      existing.latest = e;
    }

    for (const uid of Array.from(HISTORY.keys())) {
      if (!liveUids.has(uid)) HISTORY.delete(uid);
    }

    const out: TrackPath<E>[] = [];
    for (const [uid, h] of HISTORY) {
      out.push({
        uid,
        path: h.path.slice(),
        timestamps: h.timestamps.slice(),
        latest: h.latest as E,
      });
    }
    return out;
  }, [events]);
