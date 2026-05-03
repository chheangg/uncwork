import type {
  Affiliation,
  CotEvent,
  Dimension,
  LinkStatus,
} from "@/types/cot";

const AFFILIATION_MAP: Record<string, Affiliation> = {
  f: "friendly",
  h: "hostile",
};

const DIMENSION_MAP: Record<string, Dimension> = {
  A: "air",
  G: "ground",
  S: "sea_surface",
  U: "sea_subsurface",
  P: "space",
  F: "sof",
  X: "sensor",
};

export const parseAffiliation = (cotType: string): Affiliation =>
  AFFILIATION_MAP[cotType.split("-")[1]?.toLowerCase() ?? ""] ?? "unknown";

export const parseDimension = (cotType: string): Dimension =>
  DIMENSION_MAP[cotType.split("-")[2] ?? ""] ?? "other";

export const computeStatus = (confInt: number): LinkStatus => {
  if (confInt >= 0.6) return "healthy";
  if (confInt >= 0.3) return "degraded";
  if (confInt >= 0.08) return "critical";
  return "offline";
};

export const computeStale = (
  staleAtIso: string,
  now: number = Date.now(),
): boolean => {
  const staleAtMs = Date.parse(staleAtIso);
  if (Number.isNaN(staleAtMs)) return false;
  return now > staleAtMs;
};

export const computeConfInt = (event: {
  ce?: number;
  le?: number;
}): number => {
  const ceFactor = event.ce ? Math.max(0.2, 1 - event.ce / 200) : 1;
  const leFactor = event.le ? Math.max(0.2, 1 - event.le / 400) : 1;
  return Math.min(1, Math.max(0, ceFactor * leFactor));
};

type RawCot = {
  uid: string;
  cotType: string;
  sensorType: CotEvent["sensorType"];
  time: string;
  start: string;
  staleAt: string;
  lat: number;
  lon: number;
  hae?: number;
  ce?: number;
  le?: number;
  remarks?: string;
  callsign?: string;
};

export const enrichCot = (raw: RawCot): CotEvent => {
  const confInt = computeConfInt(raw);
  return {
    ...raw,
    affiliation: parseAffiliation(raw.cotType),
    dimension: parseDimension(raw.cotType),
    confInt,
    status: computeStatus(confInt),
    stale: computeStale(raw.staleAt),
  };
};
