import { PRESET_BBOX } from "@/config/constants";
import { enrichCot, parseDimension } from "@/lib/cot";
import { SENSORS_BY_DIMENSION } from "@/lib/sensor";
import type { CotEvent, Dimension, SensorType } from "@/types/cot";

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

const POSITION_VEL = 0.001;
const VELOCITY_MULT: Record<Dimension, number> = {
  air: 6,
  ground: 1,
  sea_surface: 1.5,
  sea_subsurface: 0.5,
  space: 0.2,
  sof: 1.5,
  other: 1,
};

const HEALTH_STEP = 0.012;
const HEALTH_MIN = 0.05;
const HEALTH_MAX = 0.99;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const randInRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]!;

export type MockTrack = {
  uid: string;
  cotType: string;
  dimension: Dimension;
  sensorType: SensorType;
  lat: number;
  lon: number;
  vLat: number;
  vLon: number;
  health: number;
  vHealth: number;
};

export const seedTracks = (count: number): MockTrack[] => {
  const { west, east, south, north } = PRESET_BBOX;
  return Array.from({ length: count }, (_, i) => {
    const cotType = pick(COT_TYPES);
    const dimension = parseDimension(cotType);
    const mult = VELOCITY_MULT[dimension];
    const sensorType = pick(SENSORS_BY_DIMENSION[dimension]);
    return {
      uid: `mock-${i.toString().padStart(3, "0")}`,
      cotType,
      dimension,
      sensorType,
      lat: randInRange(south, north),
      lon: randInRange(west, east),
      vLat: randInRange(-POSITION_VEL, POSITION_VEL) * mult,
      vLon: randInRange(-POSITION_VEL, POSITION_VEL) * mult,
      health: randInRange(0.55, 0.95),
      vHealth: randInRange(-HEALTH_STEP, HEALTH_STEP),
    };
  });
};

export const stepTrack = (track: MockTrack): MockTrack => {
  const { west, east, south, north } = PRESET_BBOX;
  let { lat, lon, vLat, vLon, health, vHealth } = track;

  lat += vLat;
  lon += vLon;
  if (lat < south || lat > north) vLat = -vLat;
  if (lon < west || lon > east) vLon = -vLon;

  vHealth += randInRange(-HEALTH_STEP * 0.4, HEALTH_STEP * 0.4);
  vHealth = clamp(vHealth, -HEALTH_STEP, HEALTH_STEP);
  health = clamp(health + vHealth, HEALTH_MIN, HEALTH_MAX);
  if (health === HEALTH_MIN || health === HEALTH_MAX) vHealth = -vHealth * 0.5;

  return { ...track, lat, lon, vLat, vLon, health, vHealth };
};

export const emitFromTrack = (track: MockTrack): CotEvent => {
  const now = Date.now();
  const ce = lerp(120, 4, track.health);
  const le = lerp(160, 4, track.health);
  const staleOffsetMs = lerp(-200_000, 120_000, track.health);

  return enrichCot({
    uid: track.uid,
    cotType: track.cotType,
    sensorType: track.sensorType,
    time: new Date(now).toISOString(),
    start: new Date(now).toISOString(),
    stale: new Date(now + staleOffsetMs).toISOString(),
    lat: track.lat,
    lon: track.lon,
    hae: lerp(5, 150, track.health),
    ce,
    le,
    remarks: `${pick(REMARK_FRAGMENTS)} ${track.uid}`,
  });
};
