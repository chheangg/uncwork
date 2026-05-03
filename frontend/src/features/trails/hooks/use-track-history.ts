import { useMemo } from "react";
import type { CotEvent, LinkStatus } from "@/types/cot";
import type { Sample, TrackPath } from "@/lib/track-path";
import { TRAIL_FADE_S } from "../lib/build-trails-layer";

const POSITION_EPSILON = 1e-7;
// If a track jumps farther than this between two samples, treat it
// as a re-spawn (e.g. JAMMER toggling between STASH at 89.9°N and
// its operating position) and start the trail fresh from the new
// point instead of drawing a transcontinental line. 50 km is far
// above any plausible per-tick motion in the scenarios.
const JUMP_RESET_KM = 50;

const haversineKm = (a: [number, number], b: [number, number]): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};

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

      // If the position jump is huge, treat the new point as a
      // re-spawn and reset history so the trail layer doesn't draw
      // a line back to the prior coords (commonly STASH at 89.9°N
      // or 0,0).
      if (positionChanged && haversineKm(lastPoint, point) > JUMP_RESET_KM) {
        existing.path = [point];
        existing.timestamps = [eventTime];
        existing.statuses = [e.status];
        existing.samples = [{ t: eventTime, status: e.status }];
        existing.latest = e;
        continue;
      }

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

