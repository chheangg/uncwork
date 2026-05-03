import { useMemo } from "react";
import type { CotEvent, LinkStatus } from "@/types/cot";
import type { Sample, TrackPath } from "@/lib/track-path";
import { TRAIL_FADE_S } from "../lib/build-trails-layer";

const POSITION_EPSILON = 1e-7;

type HistoryEntry = {
  path: [number, number][];
  timestamps: number[];
  statuses: LinkStatus[];
  // every ingest in the last TRAIL_FADE_S seconds, used for the
  // detail-panel sample counter and status-window strip.
  samples: Sample[];
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
          samples: [{ t: eventTime, status: e.status }],
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
        existing.timestamps.push(eventTime);
        existing.statuses.push(e.status);
      }
      existing.samples.push({ t: eventTime, status: e.status });
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
      let sampleDrop = 0;
      while (
        sampleDrop < existing.samples.length &&
        (existing.samples[sampleDrop]?.t ?? eventTime) < cutoff
      ) {
        sampleDrop++;
      }
      if (sampleDrop > 0) {
        existing.samples.splice(0, sampleDrop);
      }
    }

    const out: TrackPath<E>[] = [];
    for (const [uid, h] of HISTORY) {
      out.push({
        uid,
        path: h.path.slice(),
        timestamps: h.timestamps.slice(),
        statuses: h.statuses.slice(),
        samples: h.samples.slice(),
        latest: h.latest as E,
      });
    }
    return out;
  }, [events]);

