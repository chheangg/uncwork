import { STALE_THRESHOLDS_MS } from "@/config/constants";
import type {
  Affiliation,
  CotEvent,
  Dimension,
  LinkStatus,
} from "@/types/cot";

const AFFILIATION_MAP: Record<string, Affiliation> = {
  f: "friendly",
  h: "hostile",
  n: "neutral",
  u: "unknown",
  p: "pending",
  a: "assumed",
  s: "suspect",
};

const DIMENSION_MAP: Record<string, Dimension> = {
  A: "air",
  G: "ground",
  S: "sea_surface",
  U: "sea_subsurface",
  P: "space",
  F: "sof",
};

export const parseAffiliation = (cotType: string): Affiliation =>
  AFFILIATION_MAP[cotType.split("-")[1]?.toLowerCase() ?? ""] ?? "unknown";

export const parseDimension = (cotType: string): Dimension =>
  DIMENSION_MAP[cotType.split("-")[2] ?? ""] ?? "other";

export const computeStatus = (
  staleIso: string,
  now: number = Date.now(),
): LinkStatus => {
  const staleMs = Date.parse(staleIso);
  if (Number.isNaN(staleMs)) return "offline";
  const drift = now - staleMs;
  if (drift > STALE_THRESHOLDS_MS.critical) return "offline";
  if (drift > STALE_THRESHOLDS_MS.degraded) return "stale";
  if (drift > STALE_THRESHOLDS_MS.healthy) return "degraded";
  if (drift > 0) return "critical";
  return "healthy";
};

export const computeConfInt = (event: {
  ce?: number;
  le?: number;
  stale: string;
}): number => {
  const ageMs = Math.max(0, Date.now() - Date.parse(event.stale));
  const ageDecay = Math.exp(-ageMs / 60_000);
  const ceFactor = event.ce ? Math.max(0.2, 1 - event.ce / 200) : 1;
  const leFactor = event.le ? Math.max(0.2, 1 - event.le / 400) : 1;
  return Math.min(1, Math.max(0, ageDecay * ceFactor * leFactor));
};

type RawCot = {
  uid: string;
  cotType: string;
  time: string;
  start: string;
  stale: string;
  lat: number;
  lon: number;
  hae?: number;
  ce?: number;
  le?: number;
  remarks?: string;
};

export const enrichCot = (raw: RawCot): CotEvent => ({
  ...raw,
  affiliation: parseAffiliation(raw.cotType),
  dimension: parseDimension(raw.cotType),
  confInt: computeConfInt(raw),
  status: computeStatus(raw.stale),
});
