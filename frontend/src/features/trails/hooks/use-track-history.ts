import { useMemo } from "react";
import type { CotEvent, LinkStatus } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";

const POSITION_EPSILON = 1e-7;

type HistoryEntry = {
  path: [number, number][];
  timestamps: number[];
  statuses: LinkStatus[];
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

    for (const e of events) {
      const point: [number, number] = [e.lon, e.lat];
      const existing = HISTORY.get(e.uid);
      if (!existing) {
        HISTORY.set(e.uid, {
          path: [point],
          timestamps: [t],
          statuses: [e.status],
          latest: e,
        });
        continue;
      }

      const lastPoint = existing.path[existing.path.length - 1]!;
      const lastStatus = existing.statuses[existing.statuses.length - 1]!;
      const positionChanged =
        Math.abs(lastPoint[0] - point[0]) > POSITION_EPSILON ||
        Math.abs(lastPoint[1] - point[1]) > POSITION_EPSILON;
      const statusChanged = lastStatus !== e.status;
      if (positionChanged || statusChanged) {
        existing.path.push(point);
        existing.timestamps.push(t);
        existing.statuses.push(e.status);
      }
      existing.latest = e;
    }

    const out: TrackPath<E>[] = [];
    for (const [uid, h] of HISTORY) {
      out.push({
        uid,
        path: h.path.slice(),
        timestamps: h.timestamps.slice(),
        statuses: h.statuses.slice(),
        latest: h.latest as E,
      });
    }
    return out;
  }, [events]);
