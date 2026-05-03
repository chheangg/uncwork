import type { CotEvent, Detectors, Dimension, LinkStatus } from "@/types/cot";

const UNIT_REGEX = /\bunit=([a-z0-9_]+)/i;

/**
 * Pull the `unit=<id>` token out of a CoT `<remarks>` body. Returns
 * `undefined` when the token isn't present (mock feed, OpenSky frames).
 */
export const parseSenderUnit = (remarks: string | undefined): string | undefined => {
  if (!remarks) return undefined;
  const match = UNIT_REGEX.exec(remarks);
  return match?.[1]?.toLowerCase();
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

export const parseDimension = (cotType: string): Dimension =>
  DIMENSION_MAP[cotType.split("-")[2] ?? ""] ?? "other";

export const computeStatus = (trustScore: number): LinkStatus => {
  if (trustScore >= 0.6) return "healthy";
  if (trustScore >= 0.3) return "degraded";
  if (trustScore >= 0.08) return "critical";
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
  trustScore?: number;
  senderUnit?: string;
  sensorLat?: number;
  sensorLon?: number;
  detectors?: Detectors;
};

export const enrichCot = (raw: RawCot): CotEvent => {
  const trustScore = raw.trustScore ?? 1;
  return {
    ...raw,
    dimension: parseDimension(raw.cotType),
    trustScore,
    status: computeStatus(trustScore),
    stale: computeStale(raw.staleAt),
  };
};
