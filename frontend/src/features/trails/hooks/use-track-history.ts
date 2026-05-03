import { useMemo } from "react";
import type { CotEvent, LinkStatus } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";
import { TRAIL_FADE_S } from "../lib/build-trails-layer";

const POSITION_EPSILON = 1e-7;

// If consecutive points jump by more than this distance, treat as a
// scenario reset (the backend ndxml cursor wrapped back to the start
// of the file, teleporting the track) and reset that uid's history
// so the trail doesn't draw a giant straight line across the map.
const TELEPORT_DEG = 0.02; // ~2 km at this latitude

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
      const eventTime = t;
      
      const existing = HISTORY.get(e.uid);
      if (!existing) {
        HISTORY.set(e.uid, {
          path: [point],
          timestamps: [eventTime],
          statuses: [e.status],
          latest: e,
        });
        continue;
      }

      const lastPoint = existing.path[existing.path.length - 1]!;
      const lastStatus = existing.statuses[existing.statuses.length - 1]!;
      const dLon = Math.abs(lastPoint[0] - point[0]);
      const dLat = Math.abs(lastPoint[1] - point[1]);
      const teleported = dLon > TELEPORT_DEG || dLat > TELEPORT_DEG;
      if (teleported) {
        // Scenario looped (sender wrapped its ndxml cursor). Reset the
        // history for this uid so the trail starts fresh from the
        // wrapped position instead of jumping across the AO.
        existing.path = [point];
        existing.timestamps = [eventTime];
        existing.statuses = [e.status];
        existing.latest = e;
        continue;
      }
      const positionChanged = dLon > POSITION_EPSILON || dLat > POSITION_EPSILON;
      const statusChanged = lastStatus !== e.status;
      if (positionChanged || statusChanged) {
        existing.path.push(point);
        existing.timestamps.push(eventTime);
        existing.statuses.push(e.status);
      }
      existing.latest = e;

      const cutoff = t - TRAIL_FADE_S;
      let drop = 0;
      while (
        existing.timestamps.length - drop > 2 &&
        (existing.timestamps[drop] ?? eventTime) < cutoff
      ) {
        drop++;
      }
      if (drop > 0) {
        existing.path.splice(0, drop);
        existing.timestamps.splice(0, drop);
        existing.statuses.splice(0, drop);
      }
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

