import { PRESET_BBOX } from "@/config/constants";
import { enrichCot } from "@/lib/cot";
import { SENSORS_BY_DIMENSION } from "@/lib/sensor";
import type { CotEvent, Dimension, SensorType } from "@/types/cot";

export type MockCategory = "sensor" | "ground" | "air";

const COT_BY_CATEGORY: Record<MockCategory, string[]> = {
  sensor: ["a-f-X-S-S", "a-f-X-S-R", "a-f-X-S-O"],
  ground: ["a-f-G-U-S", "a-f-G-U-C", "a-f-G-E-S-R", "a-f-G-E-S-S"],
  air: ["a-f-A-W-D", "a-f-A-M-H", "a-f-A-M-F", "a-f-A-W-D-R"],
};

const DIMENSION_BY_CATEGORY: Record<MockCategory, Dimension> = {
  sensor: "sensor",
  ground: "ground",
  air: "air",
};

const REMARK_FRAGMENTS: Record<MockCategory, string[]> = {
  sensor: ["radar-sta", "eo-tower", "sigint-post", "acoustic-array", "seismic-node"],
  ground: ["patrol", "convoy", "checkpoint", "outpost"],
  air: ["uav", "drone", "patrol", "recon"],
};

// Mock ticks at 500ms (see use-mock-feed.ts). Per-tick deltas were
// originally tuned for a 2.5s tick; everything below is scaled to
// keep the same per-second motion / decay / delay rates while
// emitting 5x more samples for smoother icon interpolation.
const POSITION_VEL = 0.00016;
const VELOCITY_MULT: Record<MockCategory, number> = {
  sensor: 0,
  ground: 1,
  air: 6,
};

const HEALTH_STEP_BY_CATEGORY: Record<MockCategory, number> = {
  sensor: 0.0036,
  ground: 0.0024,
  air: 0.0024,
};
const HEALTH_MIN = 0.05;
const HEALTH_MAX = 0.99;

const DELAY_ENTER_PROB = 0.008;
const DELAY_EXIT_PROB = 0.036;
const DELAY_BACK_S_MIN = 25;
const DELAY_BACK_S_MAX = 95;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

const randInRange = (min: number, max: number) =>
  min + Math.random() * (max - min);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)]!;

export type MockTrack = {
  uid: string;
  category: MockCategory;
  cotType: string;
  dimension: Dimension;
  sensorType: SensorType;
  lat: number;
  lon: number;
  vLat: number;
  vLon: number;
  health: number;
  vHealth: number;
  delayed: boolean;
};

const TRACK_MIX: { category: MockCategory; count: number }[] = [
  { category: "sensor", count: 10 },
  { category: "ground", count: 9 },
  { category: "air", count: 9 },
];

export const seedTracks = (_count?: number): MockTrack[] => {
  const { west, east, south, north } = PRESET_BBOX;
  const tracks: MockTrack[] = [];
  let i = 0;
  for (const { category, count } of TRACK_MIX) {
    for (let k = 0; k < count; k++, i++) {
      const cotType = pick(COT_BY_CATEGORY[category]);
      const dimension = DIMENSION_BY_CATEGORY[category];
      const mult = VELOCITY_MULT[category];
      const sensorType = pick(SENSORS_BY_DIMENSION[dimension]);
      tracks.push({
        uid: `mock-${i.toString().padStart(3, "0")}`,
        category,
        cotType,
        dimension,
        sensorType,
        lat: randInRange(south, north),
        lon: randInRange(west, east),
        vLat: randInRange(-POSITION_VEL, POSITION_VEL) * mult,
        vLon: randInRange(-POSITION_VEL, POSITION_VEL) * mult,
        health: randInRange(0.55, 0.95),
        vHealth: randInRange(
          -HEALTH_STEP_BY_CATEGORY[category],
          HEALTH_STEP_BY_CATEGORY[category],
        ),
        delayed: false,
      });
    }
  }
  return tracks;
};

export const stepTrack = (track: MockTrack): MockTrack => {
  const { west, east, south, north } = PRESET_BBOX;
  let { lat, lon, vLat, vLon, health, vHealth, delayed } = track;
  const step = HEALTH_STEP_BY_CATEGORY[track.category];

  if (track.category !== "sensor") {
    lat += vLat;
    lon += vLon;
    if (lat < south || lat > north) vLat = -vLat;
    if (lon < west || lon > east) vLon = -vLon;
  }

  vHealth += randInRange(-step * 0.4, step * 0.4);
  vHealth = clamp(vHealth, -step, step);
  health = clamp(health + vHealth, HEALTH_MIN, HEALTH_MAX);
  if (health === HEALTH_MIN || health === HEALTH_MAX) vHealth = -vHealth * 0.5;

  if (delayed) {
    if (Math.random() < DELAY_EXIT_PROB) delayed = false;
  } else if (Math.random() < DELAY_ENTER_PROB) {
    delayed = true;
  }

  return { ...track, lat, lon, vLat, vLon, health, vHealth, delayed };
};

export const emitFromTrack = (track: MockTrack): CotEvent => {
  const now = Date.now();
  const ce = lerp(180, 2, track.health);
  const le = lerp(300, 2, track.health);
  const staleAtMs = track.delayed
    ? now - randInRange(DELAY_BACK_S_MIN, DELAY_BACK_S_MAX) * 1000
    : now + 60_000;

  return enrichCot({
    uid: track.uid,
    cotType: track.cotType,
    sensorType: track.sensorType,
    time: new Date(now).toISOString(),
    start: new Date(now).toISOString(),
    staleAt: new Date(staleAtMs).toISOString(),
    lat: track.lat,
    lon: track.lon,
    hae: lerp(5, 80, track.health),
    ce,
    le,
    remarks: `${pick(REMARK_FRAGMENTS[track.category])} ${track.uid}`,
  });
};
