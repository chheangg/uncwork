import type { CotEvent, FingerprintMatch } from "@/types/cot";

/**
 * **FR-04 attribution rollup.** Per-ground-asset state derived from the
 * stream of fingerprint-bearing events. Aggregates by `senderUnit`
 * (parsed from CoT `<remarks>` `unit=` token) and pins the badge over
 * the unit's own sensor position, not the tracked asset's position.
 */
export type Attribution = {
  /** Lowercase unit identifier (e.g. "unit_c"). */
  unit: string;
  /** Most recent classifier match seen on this unit's wire. */
  fingerprint: FingerprintMatch;
  /** Number of distinct frames in the live window that carried this tag. */
  matchCount: number;
  /** Ground asset's last known sensor position, used for badge placement. */
  sensorLat: number;
  sensorLon: number;
  /** Wall-clock millis of the most recent matching frame. */
  lastSeenMs: number;
};

/**
 * How long a fingerprint match remains "active" on a unit before the
 * badge fades. The classifier is windowed at 60s on the listener; 30s
 * here keeps the visual responsive to changes without flickering on
 * single-frame gaps.
 */
export const ATTRIBUTION_TTL_MS = 30_000;

/** Below this confidence we don't show a badge at all. */
export const ATTRIBUTION_MIN_CONFIDENCE = 0.3;

/**
 * Reduce the live event list into a per-unit attribution summary.
 * Pure derivation — no store needed. Walks the events array, groups
 * by `senderUnit`, and picks the most recent fingerprint match per
 * unit (subject to the TTL + confidence floor).
 *
 * Match counting is *over the live window* (events younger than the
 * TTL whose fingerprint tag matches the chosen tag for the unit).
 * That's a defensible "how many recent observations support this
 * attribution" number for the drill-down.
 */
export const deriveAttributions = (
  events: CotEvent[],
  nowMs: number,
): Attribution[] => {
  const cutoff = nowMs - ATTRIBUTION_TTL_MS;

  type Bucket = {
    unit: string;
    latest: { fingerprint: FingerprintMatch; ms: number };
    sensorLat: number;
    sensorLon: number;
    counts: Map<string, number>;
  };
  const byUnit = new Map<string, Bucket>();

  for (const e of events) {
    if (!e.senderUnit) continue;
    if (e.sensorLat === undefined || e.sensorLon === undefined) continue;
    const fp = e.detectors?.fingerprint;
    if (!fp) continue;
    if (fp.confidence < ATTRIBUTION_MIN_CONFIDENCE) continue;

    const ms = Date.parse(e.time);
    if (!Number.isFinite(ms) || ms < cutoff) continue;

    const existing = byUnit.get(e.senderUnit);
    if (!existing) {
      byUnit.set(e.senderUnit, {
        unit: e.senderUnit,
        latest: { fingerprint: fp, ms },
        sensorLat: e.sensorLat,
        sensorLon: e.sensorLon,
        counts: new Map([[fp.tag, 1]]),
      });
      continue;
    }

    existing.counts.set(fp.tag, (existing.counts.get(fp.tag) ?? 0) + 1);
    if (ms > existing.latest.ms) {
      existing.latest = { fingerprint: fp, ms };
      existing.sensorLat = e.sensorLat;
      existing.sensorLon = e.sensorLon;
    }
  }

  return Array.from(byUnit.values()).map((b) => ({
    unit: b.unit,
    fingerprint: b.latest.fingerprint,
    matchCount: b.counts.get(b.latest.fingerprint.tag) ?? 1,
    sensorLat: b.sensorLat,
    sensorLon: b.sensorLon,
    lastSeenMs: b.latest.ms,
  }));
};
