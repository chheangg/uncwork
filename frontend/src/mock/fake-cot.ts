import { PRESET_BBOX } from "@/config/constants";
import { enrichCot } from "@/lib/cot";
import type { CotEvent } from "@/types/cot";

const COT_TYPES = [
  "a-f-G-U-C",
  "a-f-G-U-C-I",
  "a-f-A-M-F",
  "a-f-S-X-M",
  "a-h-G-U-C",
  "a-h-A-M-F",
  "a-h-G-U-C-I",
  "a-n-G-U-C",
  "a-u-A-M-F",
  "a-p-G",
  "a-s-G-U-C",
];

const REMARK_FRAGMENTS = [
  "patrol",
  "static",
  "uav",
  "convoy",
  "outpost",
  "checkpoint",
  "drone",
  "asset",
];

const randInRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

export type MockTrack = {
  uid: string;
  cotType: string;
  lat: number;
  lon: number;
  vLat: number;
  vLon: number;
};

export const seedTracks = (count: number): MockTrack[] => {
  const { west, east, south, north } = PRESET_BBOX;
  return Array.from({ length: count }, (_, i) => ({
    uid: `mock-${i.toString().padStart(3, "0")}`,
    cotType: pick(COT_TYPES),
    lat: randInRange(south, north),
    lon: randInRange(west, east),
    vLat: randInRange(-0.00012, 0.00012),
    vLon: randInRange(-0.00012, 0.00012),
  }));
};

export const stepTrack = (track: MockTrack): MockTrack => {
  const { west, east, south, north } = PRESET_BBOX;
  let { lat, lon, vLat, vLon } = track;
  lat += vLat;
  lon += vLon;
  if (lat < south || lat > north) vLat = -vLat;
  if (lon < west || lon > east) vLon = -vLon;
  return { ...track, lat, lon, vLat, vLon };
};

export const emitFromTrack = (track: MockTrack): CotEvent => {
  const now = Date.now();
  const staleSkewMs = randInRange(-30_000, 90_000);
  const ce = randInRange(2, 80);
  const le = randInRange(2, 120);
  return enrichCot({
    uid: track.uid,
    cotType: track.cotType,
    time: new Date(now).toISOString(),
    start: new Date(now).toISOString(),
    stale: new Date(now + staleSkewMs).toISOString(),
    lat: track.lat,
    lon: track.lon,
    hae: randInRange(5, 150),
    ce,
    le,
    remarks: `${pick(REMARK_FRAGMENTS)} ${track.uid}`,
  });
};
