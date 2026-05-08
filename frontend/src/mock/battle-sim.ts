import { enrichCot } from "@/lib/cot";
import type {
  CotEvent,
  Detectors,
  Dimension,
  FingerprintMatch,
  SensorType,
} from "@/types/cot";

/**
 * Free-form battle simulator. Spawns a fixed cast of units in the
 * Donetsk-area AO and runs a per-tick rules engine each call to
 * `stepBattle`. Each unit has a kind, a state machine, and a small
 * set of action rules that drive movement and combat. There is no
 * scripted timeline — units react to each other.
 *
 * Rules of action (per tick = 0.5 s):
 *   FRIENDLY TROOP / ARMOR
 *     patrol     — move toward forward waypoint
 *     engage     — within engageRange of a hostile, both lose hp
 *     retreat    — hp ≤ retreatHp, run back to base
 *     recover    — at base, hp recovers, then patrol again
 *   FRIENDLY AIR
 *     circle     — orbit a fixed center at fixed radius
 *     pursue     — break orbit to chase the nearest hostile UAV
 *                  inside detectRange; air does not take damage
 *     return     — UAV killed or out of range, fly back to orbit
 *   HOSTILE UAV
 *     push       — move toward the front line; while in range of
 *                  any friendly, drop that friendly's TRUST score
 *                  (simulates EW jamming on the wire)
 *     evade      — being pursued, drift away from the chasing air
 *     retreat    — hp low, run back to spawn line
 *   HOSTILE INFANTRY
 *     advance    — push toward the front line
 *     engage     — same as friendly troop, mirrored
 *     retreat    — hp low, fall back
 *
 * Trust vs hp:
 *   - hp drives ce/le and the "recover/retreat" decision.
 *   - trust is the 0..1 wire score consumed by every layer in the
 *     frontend; it dips when a hostile UAV is jamming nearby and
 *     recovers when no jammer is in range. This is what makes the
 *     fake AI recommender's bars actually move on the battle map.
 */

const DEG_LAT_PER_M = 1 / 111_000;
const degLonPerM = (lat: number): number =>
  1 / (111_000 * Math.cos((lat * Math.PI) / 180));

const haversineM = (
  a: [number, number],
  b: [number, number],
): number => {
  const R = 6_371_000;
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

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

// AO geometry (Donetsk area, matches the rest of the demo's bbox).
// Friendlies sit south, hostiles spawn north, the front line runs
// east-west across the middle.
const FRIENDLY_BASE: [number, number] = [37.005, 48.435];
const HOSTILE_SPAWN_LINE = 48.555;
const FRONT_LINE_LAT = 48.49;
// Bounds — units never wander outside this rectangle. Slightly
// inside the global PRESET_BBOX so icons stay on-screen at the
// preset zoom.
const BOUND = {
  west: 36.93,
  east: 37.13,
  south: 48.41,
  north: 48.56,
} as const;

export type BattleKind =
  | "troop"
  | "armor"
  | "air"
  | "rotor"
  | "scout"
  | "arty"
  | "uav"
  | "enemy"
  | "howitzer";

type Faction = "friendly" | "hostile";

type BehaviorState =
  | "patrol"
  | "engage"
  | "retreat"
  | "recover"
  | "circle"
  | "pursue"
  | "return"
  | "push"
  | "evade"
  | "advance";

export type BattleUnit = {
  uid: string;
  callsign: string;
  kind: BattleKind;
  faction: Faction;
  cotType: string;
  dimension: Dimension;
  sensorType: SensorType;
  // physical
  lat: number;
  lon: number;
  hae: number;
  speedMps: number;
  // tunables
  engageRangeM: number;
  detectRangeM: number;
  retreatHp: number;
  recoverHp: number;
  // dynamic
  hp: number;
  trust: number;
  state: BehaviorState;
  goalLon: number;
  goalLat: number;
  targetUid?: string;
  // Set on friendlies in the current tick's jam pass — used to attach
  // an FR-04 fingerprint to the emitted CoT so the attribution layer
  // and AI panel both light up when EW is on the wire.
  jammed?: boolean;
  // Set on BANDITs that are currently jamming someone — used both to
  // make them linger over their target and to mark the unit on the
  // wire as the visible aggressor.
  jamming?: boolean;
  // air-only
  orbitLon?: number;
  orbitLat?: number;
  orbitRadiusM?: number;
  orbitAngleRad?: number;
  orbitAngularVel?: number; // rad/s
  // ground forward waypoint (re-randomized when reached)
  patrolGoalLon?: number;
  patrolGoalLat?: number;
};

type Spec = {
  kind: BattleKind;
  faction: Faction;
  cotType: string;
  dimension: Dimension;
  sensorType: SensorType;
  hae: number;
  speedMps: number;
  engageRangeM: number;
  detectRangeM: number;
  retreatHp: number;
  recoverHp: number;
};

const SPEC: Record<BattleKind, Spec> = {
  troop: {
    kind: "troop",
    faction: "friendly",
    cotType: "a-f-G-U-S",
    dimension: "ground",
    sensorType: "eo_ir",
    hae: 5,
    speedMps: 5.5,
    engageRangeM: 700,
    detectRangeM: 1200,
    retreatHp: 0.3,
    recoverHp: 0.85,
  },
  armor: {
    kind: "armor",
    faction: "friendly",
    cotType: "a-f-G-U-C",
    dimension: "ground",
    sensorType: "radar",
    hae: 6,
    speedMps: 14,
    engageRangeM: 1500,
    detectRangeM: 2200,
    retreatHp: 0.25,
    recoverHp: 0.85,
  },
  air: {
    kind: "air",
    faction: "friendly",
    cotType: "a-f-A-M-F",
    dimension: "air",
    sensorType: "radar",
    hae: 1800,
    speedMps: 110,
    engageRangeM: 1800,
    detectRangeM: 3500,
    retreatHp: 0.2,
    recoverHp: 0.9,
  },
  rotor: {
    kind: "rotor",
    faction: "friendly",
    cotType: "a-f-A-M-H",
    dimension: "air",
    sensorType: "eo_ir",
    hae: 350,
    speedMps: 70,
    engageRangeM: 1200,
    detectRangeM: 2500,
    retreatHp: 0.25,
    recoverHp: 0.85,
  },
  scout: {
    kind: "scout",
    faction: "friendly",
    cotType: "a-f-A-M-F-R",
    dimension: "air",
    sensorType: "eo_ir",
    hae: 1200,
    speedMps: 45,
    engageRangeM: 0,
    detectRangeM: 4000,
    retreatHp: 0.2,
    recoverHp: 0.9,
  },
  arty: {
    kind: "arty",
    faction: "friendly",
    cotType: "a-f-G-E-S-R",
    dimension: "ground",
    sensorType: "radar",
    hae: 5,
    speedMps: 0,
    engageRangeM: 6000,
    detectRangeM: 8000,
    retreatHp: 0,
    recoverHp: 1,
  },
  uav: {
    kind: "uav",
    faction: "hostile",
    cotType: "a-h-A-M-F-Q",
    dimension: "air",
    sensorType: "ew",
    hae: 900,
    speedMps: 42,
    // Wider detect range = bigger jam radius. Tuned so a BANDIT
    // overhead reaches every friendly in a typical squad cluster.
    engageRangeM: 0,
    detectRangeM: 2500,
    retreatHp: 0.25,
    recoverHp: 0.9,
  },
  enemy: {
    kind: "enemy",
    faction: "hostile",
    cotType: "a-h-G-U-C",
    dimension: "ground",
    sensorType: "eo_ir",
    hae: 5,
    speedMps: 6,
    engageRangeM: 700,
    detectRangeM: 1200,
    retreatHp: 0.3,
    recoverHp: 0.85,
  },
  howitzer: {
    kind: "howitzer",
    faction: "hostile",
    cotType: "a-h-G-E-S-R",
    dimension: "ground",
    sensorType: "radar",
    hae: 5,
    speedMps: 0,
    engageRangeM: 6000,
    detectRangeM: 8000,
    retreatHp: 0,
    recoverHp: 1,
  },
};

const CALLSIGN: Record<BattleKind, string> = {
  troop: "TROOP",
  armor: "ARMOR",
  air: "HAWK",
  rotor: "ROTOR",
  scout: "SCOUT",
  arty: "ARTY",
  uav: "BANDIT",
  enemy: "RED",
  howitzer: "HOWITZER",
};

let NEXT_UID = 0;
const newUid = (kind: BattleKind): string =>
  `battle-${kind}-${(NEXT_UID++).toString().padStart(3, "0")}`;

const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

const randomPatrolGoal = (): [number, number] => [
  rand(BOUND.west + 0.01, BOUND.east - 0.01),
  rand(FRONT_LINE_LAT - 0.015, FRONT_LINE_LAT + 0.005),
];

const randomHostileGoal = (): [number, number] => [
  rand(BOUND.west + 0.01, BOUND.east - 0.01),
  rand(FRONT_LINE_LAT - 0.005, FRONT_LINE_LAT + 0.015),
];

const make = (
  kind: BattleKind,
  callIdx: number,
  start: [number, number],
  init?: Partial<BattleUnit>,
): BattleUnit => {
  const spec = SPEC[kind];
  const callsign = `${CALLSIGN[kind]}-${(callIdx + 1).toString().padStart(2, "0")}`;
  const goal =
    spec.faction === "friendly"
      ? randomPatrolGoal()
      : randomHostileGoal();
  return {
    uid: newUid(kind),
    callsign,
    kind,
    faction: spec.faction,
    cotType: spec.cotType,
    dimension: spec.dimension,
    sensorType: spec.sensorType,
    lat: start[1],
    lon: start[0],
    hae: spec.hae,
    speedMps: spec.speedMps,
    engageRangeM: spec.engageRangeM,
    detectRangeM: spec.detectRangeM,
    retreatHp: spec.retreatHp,
    recoverHp: spec.recoverHp,
    hp: rand(0.85, 0.99),
    trust: rand(0.85, 0.99),
    state: "patrol",
    goalLon: goal[0],
    goalLat: goal[1],
    patrolGoalLon: goal[0],
    patrolGoalLat: goal[1],
    ...init,
  };
};

const makeAir = (
  callIdx: number,
  center: [number, number],
  radiusM: number,
  cw = true,
): BattleUnit => {
  const u = make("air", callIdx, center);
  u.orbitLon = center[0];
  u.orbitLat = center[1];
  u.orbitRadiusM = radiusM;
  u.orbitAngleRad = Math.random() * Math.PI * 2;
  // angular velocity so the loop time at speedMps is ~ 2π·R / v.
  u.orbitAngularVel = (cw ? -1 : 1) * (u.speedMps / radiusM);
  u.state = "circle";
  return u;
};

export const seedBattle = (): BattleUnit[] => {
  NEXT_UID = 0;
  const units: BattleUnit[] = [];

  // FRIENDLY GROUND ──────────────────────────────────────────────
  // Six troop squads strung along the southern base, each driving
  // toward an independent forward waypoint so the line moves.
  for (let i = 0; i < 6; i++) {
    const start: [number, number] = [
      FRIENDLY_BASE[0] + rand(-0.03, 0.03),
      FRIENDLY_BASE[1] + rand(-0.005, 0.005),
    ];
    units.push(make("troop", i, start));
  }
  // Two armor vehicles, slightly forward of the troops.
  for (let i = 0; i < 2; i++) {
    const start: [number, number] = [
      FRIENDLY_BASE[0] + rand(-0.02, 0.02),
      FRIENDLY_BASE[1] + 0.01 + rand(-0.003, 0.003),
    ];
    units.push(make("armor", i, start));
  }
  // Two artillery pieces dug in at base. Stationary, long-range support.
  for (let i = 0; i < 2; i++) {
    const start: [number, number] = [
      FRIENDLY_BASE[0] - 0.025 + i * 0.05,
      FRIENDLY_BASE[1] - 0.005,
    ];
    const u = make("arty", i, start);
    u.state = "engage";
    u.goalLon = u.lon;
    u.goalLat = u.lat;
    units.push(u);
  }

  // FRIENDLY AIR ─────────────────────────────────────────────────
  // Two fixed-wing fighters orbiting opposite-rotation over distinct
  // centers so they're visibly looping on the map.
  units.push(makeAir(0, [37.02, 48.46], 1500, true));
  units.push(makeAir(1, [37.07, 48.475], 1700, false));

  // One recon UAV slowly orbiting forward of base — friendly air with
  // no combat, just visually present.
  {
    const u = make("scout", 0, [37.045, 48.475]);
    u.orbitLon = 37.045;
    u.orbitLat = 48.475;
    u.orbitRadiusM = 2400;
    u.orbitAngleRad = Math.random() * Math.PI * 2;
    u.orbitAngularVel = u.speedMps / u.orbitRadiusM;
    u.state = "circle";
    units.push(u);
  }

  // One helicopter that floats toward whatever ground combat is
  // active — orbits base when nothing's contested.
  {
    const u = make("rotor", 0, [
      FRIENDLY_BASE[0] + 0.005,
      FRIENDLY_BASE[1] + 0.012,
    ]);
    u.state = "patrol";
    units.push(u);
  }

  // HOSTILE ──────────────────────────────────────────────────────
  // Six attack UAVs spread across the northern half of the AO so
  // jamming is on the wire from tick zero — not 3 minutes after
  // they slowly drift down from the spawn line.
  for (let i = 0; i < 6; i++) {
    const start: [number, number] = [
      rand(BOUND.west + 0.02, BOUND.east - 0.02),
      // Whole northern band: front line (48.49) up to spawn line
      // (48.555). At the lower end they're already over the friendly
      // patrol corridor; at the upper end they're inbound from the
      // north. Mix produces a constantly-pressing front.
      rand(FRONT_LINE_LAT, HOSTILE_SPAWN_LINE),
    ];
    const u = make("uav", i, start);
    u.state = "push";
    u.hae = SPEC.uav.hae + rand(-150, 200);
    units.push(u);
  }
  // Four hostile infantry squads pushing south.
  for (let i = 0; i < 4; i++) {
    const start: [number, number] = [
      rand(BOUND.west + 0.04, BOUND.east - 0.04),
      HOSTILE_SPAWN_LINE - 0.01 + rand(-0.005, 0.005),
    ];
    const u = make("enemy", i, start);
    u.state = "advance";
    units.push(u);
  }
  // One hostile howitzer at the spawn line — counterpart to friendly
  // arty, lobs long-range fires south.
  {
    const u = make("howitzer", 0, [
      rand(BOUND.west + 0.05, BOUND.east - 0.05),
      HOSTILE_SPAWN_LINE - 0.002,
    ]);
    u.state = "engage";
    u.goalLon = u.lon;
    u.goalLat = u.lat;
    units.push(u);
  }
  return units;
};

const moveToward = (
  unit: BattleUnit,
  goalLon: number,
  goalLat: number,
  dt: number,
): void => {
  const dLatM = (goalLat - unit.lat) / DEG_LAT_PER_M;
  const dLonM = (goalLon - unit.lon) / degLonPerM(unit.lat);
  const dist = Math.hypot(dLatM, dLonM);
  if (dist < 1) return;
  const step = Math.min(unit.speedMps * dt, dist);
  const nx = dLonM / dist;
  const ny = dLatM / dist;
  unit.lon += nx * step * degLonPerM(unit.lat);
  unit.lat += ny * step * DEG_LAT_PER_M;
  // Hard clamp inside bounds so a stray goal doesn't drift the unit
  // off the map if its goal logic glitches.
  unit.lon = clamp(unit.lon, BOUND.west, BOUND.east);
  unit.lat = clamp(unit.lat, BOUND.south, BOUND.north);
};

const stepCircle = (unit: BattleUnit, dt: number): void => {
  if (
    unit.orbitLon === undefined ||
    unit.orbitLat === undefined ||
    unit.orbitRadiusM === undefined ||
    unit.orbitAngleRad === undefined ||
    unit.orbitAngularVel === undefined
  )
    return;
  unit.orbitAngleRad += unit.orbitAngularVel * dt;
  const radLat = unit.orbitRadiusM * DEG_LAT_PER_M;
  const radLon = unit.orbitRadiusM * degLonPerM(unit.orbitLat);
  unit.lon = unit.orbitLon + radLon * Math.cos(unit.orbitAngleRad);
  unit.lat = unit.orbitLat + radLat * Math.sin(unit.orbitAngleRad);
};

const findNearest = (
  unit: BattleUnit,
  candidates: BattleUnit[],
  maxRangeM: number,
): { other: BattleUnit; distM: number } | null => {
  let best: { other: BattleUnit; distM: number } | null = null;
  for (const other of candidates) {
    if (other.uid === unit.uid) continue;
    if (other.hp <= 0) continue;
    const d = haversineM([unit.lon, unit.lat], [other.lon, other.lat]);
    if (d > maxRangeM) continue;
    if (!best || d < best.distM) best = { other, distM: d };
  }
  return best;
};

export const stepBattle = (units: BattleUnit[], dtSec = 0.5): BattleUnit[] => {
  const friendlies = units.filter((u) => u.faction === "friendly");
  const hostiles = units.filter((u) => u.faction === "hostile");

  // 1. Decide state transitions for each unit based on neighborhood.
  for (const u of units) {
    if (u.hp <= 0) continue;

    // Stationary fires platforms — never change state, never move.
    if (u.kind === "arty" || u.kind === "howitzer") {
      u.state = "engage";
      continue;
    }

    // Recon UAV: just orbit, never engage.
    if (u.kind === "scout") {
      u.state = "circle";
      continue;
    }

    // Helicopter: bias toward the nearest friendly ground unit in
    // contact, otherwise loiter near base. The ROTOR's job in the
    // demo is to be the visibly-mobile friendly air — not orbiting,
    // not pursuing UAVs, just shadowing the front line.
    if (u.kind === "rotor") {
      const contestedFriendly = units.find(
        (x) =>
          x.faction === "friendly" &&
          x.state === "engage" &&
          (x.kind === "troop" || x.kind === "armor"),
      );
      if (contestedFriendly) {
        u.state = "pursue";
        u.goalLon = contestedFriendly.lon;
        u.goalLat = contestedFriendly.lat;
      } else {
        u.state = "patrol";
        // Drift somewhere ahead of base.
        const d = haversineM(
          [u.lon, u.lat],
          [u.goalLon, u.goalLat],
        );
        if (d < 200) {
          u.goalLon = FRIENDLY_BASE[0] + rand(-0.04, 0.04);
          u.goalLat = FRIENDLY_BASE[1] + rand(0.005, 0.025);
        }
      }
      continue;
    }

    if (u.kind === "air") {
      const target = findNearest(u, hostiles.filter((h) => h.kind === "uav"), u.detectRangeM);
      if (target) {
        u.state = "pursue";
        u.targetUid = target.other.uid;
        u.goalLon = target.other.lon;
        u.goalLat = target.other.lat;
      } else if (u.state === "pursue" || u.state === "return") {
        u.state = "return";
        if (u.orbitLon !== undefined && u.orbitLat !== undefined) {
          u.goalLon = u.orbitLon;
          u.goalLat = u.orbitLat;
          // Snap into orbit once we're within one orbit-radius.
          const d = haversineM(
            [u.lon, u.lat],
            [u.orbitLon, u.orbitLat],
          );
          if (d < (u.orbitRadiusM ?? 0) + 200) {
            u.state = "circle";
            u.targetUid = undefined;
          }
        }
      }
      continue;
    }

    if (u.kind === "uav") {
      // Recover at spawn line if we made it home wounded.
      const atSpawn = u.lat >= HOSTILE_SPAWN_LINE - 0.005;
      if (u.state === "retreat" && atSpawn) {
        u.state = "recover";
      }
      if (u.state === "recover" && u.hp >= u.recoverHp) {
        u.state = "push";
        const g = randomHostileGoal();
        u.goalLon = g[0];
        u.goalLat = g[1];
      }
      if (u.state === "recover") continue;

      // Retreat decision dominates.
      if (u.hp < u.retreatHp) {
        u.state = "retreat";
        u.goalLat = HOSTILE_SPAWN_LINE;
        u.goalLon = clamp(u.lon, BOUND.west + 0.02, BOUND.east - 0.02);
        continue;
      }
      // Evade if any air unit is pursuing us specifically.
      const chaser = friendlies
        .filter((f) => f.kind === "air" && f.targetUid === u.uid)
        .map<{ other: BattleUnit; distM: number }>((f) => ({
          other: f,
          distM: haversineM([u.lon, u.lat], [f.lon, f.lat]),
        }))
        .sort((a, b) => a.distM - b.distM)[0];
      if (chaser && chaser.distM < SPEC.air.engageRangeM * 1.4) {
        u.state = "evade";
        // Vector directly away from the chaser, into the hostile zone.
        const dLatM = (u.lat - chaser.other.lat) / DEG_LAT_PER_M;
        const dLonM = (u.lon - chaser.other.lon) / degLonPerM(u.lat);
        const dist = Math.hypot(dLatM, dLonM) || 1;
        const aheadM = 1500;
        u.goalLon =
          u.lon + (dLonM / dist) * aheadM * degLonPerM(u.lat);
        u.goalLat = u.lat + (dLatM / dist) * aheadM * DEG_LAT_PER_M;
        u.goalLat = Math.min(u.goalLat, BOUND.north);
      } else if (u.jamming && u.targetUid) {
        // Loiter directly over the friendly we're jamming. The jam
        // pass at end-of-tick re-points goalLon/goalLat to the
        // target's live position; we just keep state=push so move-
        // ment applies.
        u.state = "push";
      } else {
        u.state = "push";
        // Hunt — head toward the nearest live friendly so we keep
        // pressure on the front line instead of drifting through
        // empty waypoints. This is what makes jamming frequent.
        const prey = findNearest(u, friendlies, 50_000);
        if (prey) {
          u.goalLon = prey.other.lon;
          u.goalLat = prey.other.lat;
        }
      }
      continue;
    }

    // Ground units (troop / armor / enemy).
    const enemies = u.faction === "friendly" ? hostiles : friendlies;
    // Ground-vs-ground only — UAV hits friendlies via the trust drop
    // in step 3, not hp; arty/howitzer fire from rear via step 3
    // long-range pass; scout/rotor never engage ground.
    const GROUND_ENGAGE_KINDS: BattleKind[] = ["troop", "armor", "enemy"];
    const groundEnemies = enemies.filter((e) =>
      GROUND_ENGAGE_KINDS.includes(e.kind),
    );

    // Recover at base/spawn line.
    const homeLine = u.faction === "friendly" ? BOUND.south + 0.02 : BOUND.north - 0.02;
    const atHome =
      u.faction === "friendly"
        ? u.lat <= FRIENDLY_BASE[1] + 0.005
        : u.lat >= HOSTILE_SPAWN_LINE - 0.01;
    if (u.state === "retreat" && atHome) {
      u.state = "recover";
    }
    if (u.state === "recover" && u.hp >= u.recoverHp) {
      u.state = u.faction === "friendly" ? "patrol" : "advance";
      const g = u.faction === "friendly" ? randomPatrolGoal() : randomHostileGoal();
      u.goalLon = g[0];
      u.goalLat = g[1];
      u.patrolGoalLon = g[0];
      u.patrolGoalLat = g[1];
    }

    if (u.state === "recover") continue;

    if (u.hp < u.retreatHp) {
      u.state = "retreat";
      u.goalLat = homeLine;
      u.goalLon = clamp(u.lon, BOUND.west + 0.02, BOUND.east - 0.02);
      u.targetUid = undefined;
      continue;
    }

    const contact = findNearest(u, groundEnemies, u.engageRangeM);
    if (contact) {
      u.state = "engage";
      u.targetUid = contact.other.uid;
      u.goalLon = contact.other.lon;
      u.goalLat = contact.other.lat;
      continue;
    }

    // No contact — patrol. If we've reached the patrol waypoint,
    // pick a new one near the front.
    const patrolDist = haversineM(
      [u.lon, u.lat],
      [u.goalLon, u.goalLat],
    );
    if (patrolDist < 150) {
      const g = u.faction === "friendly" ? randomPatrolGoal() : randomHostileGoal();
      u.goalLon = g[0];
      u.goalLat = g[1];
    }
    u.state = u.faction === "friendly" ? "patrol" : "advance";
    u.targetUid = undefined;
  }

  // 2. Apply movement based on the new state.
  for (const u of units) {
    if (u.hp <= 0) continue;
    if (u.kind === "arty" || u.kind === "howitzer") continue; // dug in
    if (u.state === "circle") {
      stepCircle(u, dtSec);
      continue;
    }
    moveToward(u, u.goalLon, u.goalLat, dtSec);
  }

  // 3. Resolve interactions: ground-vs-ground hp drain, air-vs-uav
  // hp drain, uav-vs-friendly trust drain.
  for (const u of units) {
    if (u.hp <= 0) continue;

    // Air kills UAV (no return damage to air).
    if (u.kind === "air") {
      const target = units.find((x) => x.uid === u.targetUid && x.kind === "uav");
      if (target) {
        const d = haversineM([u.lon, u.lat], [target.lon, target.lat]);
        if (d < u.engageRangeM) {
          target.hp = clamp(target.hp - 0.06 * dtSec, 0, 1);
          target.trust = clamp(target.trust - 0.04 * dtSec, 0, 1);
        }
      }
    }

    // Ground engaging another ground — both lose hp.
    if ((u.kind === "troop" || u.kind === "armor" || u.kind === "enemy") && u.state === "engage") {
      const target = units.find((x) => x.uid === u.targetUid);
      if (target && target.hp > 0) {
        const d = haversineM([u.lon, u.lat], [target.lon, target.lat]);
        if (d < Math.max(u.engageRangeM, target.engageRangeM)) {
          // Damage scales with kind — armor hits harder.
          const myDamage = u.kind === "armor" ? 0.05 : 0.035;
          target.hp = clamp(target.hp - myDamage * dtSec, 0, 1);
        }
      }
    }

    // Stationary fires — arty/howitzer pick the nearest enemy ground
    // unit in range and chip its hp from the rear. No return fire.
    if (u.kind === "arty" || u.kind === "howitzer") {
      const enemies = u.faction === "friendly" ? hostiles : friendlies;
      const target = findNearest(
        u,
        enemies.filter(
          (e) => e.kind === "troop" || e.kind === "armor" || e.kind === "enemy",
        ),
        u.engageRangeM,
      );
      if (target) {
        target.other.hp = clamp(target.other.hp - 0.018 * dtSec, 0, 1);
      }
    }

    // Helicopter close support — when within range of a friendly
    // troop/armor in contact, drain hostile hp around them.
    if (u.kind === "rotor") {
      const target = findNearest(
        u,
        hostiles.filter(
          (h) => h.kind === "enemy" || h.kind === "troop" || h.kind === "armor",
        ),
        u.engageRangeM,
      );
      if (target) {
        target.other.hp = clamp(target.other.hp - 0.04 * dtSec, 0, 1);
      }
    }
  }

  // UAV jams nearby friendlies — drops their TRUST score hard and
  // tags both sides so the wire shows what's happening: friendlies
  // get an FR-04 fingerprint match (visible as a red badge), BANDITs
  // get marked `jamming` so they hover over their target instead of
  // racing south. Recovery happens in the lull when no jammer is in
  // range.
  const liveUavs = units.filter((u) => u.kind === "uav" && u.hp > 0);
  for (const u of liveUavs) {
    u.jamming = false;
  }
  for (const f of friendlies) {
    if (f.hp <= 0) {
      f.jammed = false;
      continue;
    }
    let attacker: BattleUnit | null = null;
    let attackerDist = Infinity;
    for (const j of liveUavs) {
      const d = haversineM([f.lon, f.lat], [j.lon, j.lat]);
      if (d < j.detectRangeM && d < attackerDist) {
        attacker = j;
        attackerDist = d;
      }
    }
    if (attacker) {
      // Aggressive drop — within ~3 ticks (1.5s) trust visibly tanks
      // from 0.95 to ~0.4 (degraded). Keeps the demo readable without
      // having to wait 5+ seconds for the bar to move.
      f.trust = clamp(f.trust - 0.45 * dtSec, 0.05, 1);
      f.jammed = true;
      attacker.jamming = true;
      // The first BANDIT in range claims this friendly as its target
      // and lingers over it instead of pushing south, so the visual
      // pairing is obvious.
      if (!attacker.targetUid) {
        attacker.targetUid = f.uid;
        attacker.goalLon = f.lon;
        attacker.goalLat = f.lat;
      }
    } else {
      f.trust = clamp(f.trust + 0.12 * dtSec, 0, 0.99);
      f.jammed = false;
    }
  }
  // BANDITs that were jamming and lost their target return to push.
  for (const u of liveUavs) {
    if (!u.jamming) {
      u.targetUid = undefined;
    } else if (u.targetUid) {
      const tgt = units.find((x) => x.uid === u.targetUid);
      if (tgt) {
        u.goalLon = tgt.lon;
        u.goalLat = tgt.lat;
      }
    }
  }

  // hp-based recovery only when actually in recover state at home.
  for (const u of units) {
    if (u.state === "recover") {
      u.hp = clamp(u.hp + 0.08 * dtSec, 0, 1);
      u.trust = clamp(u.trust + 0.05 * dtSec, 0, 0.99);
    }
  }

  // 4. Respawn destroyed units after a beat so the demo doesn't
  // gradually empty out. Friendlies respawn at base, hostiles at
  // the spawn line.
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.hp > 0) continue;
    if (u.faction === "friendly") {
      const start: [number, number] = [
        FRIENDLY_BASE[0] + rand(-0.02, 0.02),
        FRIENDLY_BASE[1] + rand(-0.005, 0.005),
      ];
      u.lat = start[1];
      u.lon = start[0];
      u.hp = rand(0.85, 0.99);
      u.trust = rand(0.85, 0.99);
      const orbitsHere = u.kind === "air" || u.kind === "scout";
      const stationary = u.kind === "arty";
      u.state = orbitsHere ? "circle" : stationary ? "engage" : "recover";
      if (orbitsHere && u.orbitLon !== undefined && u.orbitLat !== undefined) {
        u.lat = u.orbitLat;
        u.lon = u.orbitLon;
      }
    } else {
      const start: [number, number] =
        u.kind === "uav"
          ? [
              rand(BOUND.west + 0.02, BOUND.east - 0.02),
              // Respawn anywhere in the contested band so jamming
              // resumes within seconds — not after a 7 km transit.
              rand(FRONT_LINE_LAT + 0.005, HOSTILE_SPAWN_LINE - 0.01),
            ]
          : [
              rand(BOUND.west + 0.04, BOUND.east - 0.04),
              HOSTILE_SPAWN_LINE - 0.01 + rand(-0.005, 0.005),
            ];
      u.lat = start[1];
      u.lon = start[0];
      u.hp = rand(0.85, 0.99);
      u.trust = rand(0.85, 0.99);
      u.state = u.kind === "uav" ? "push" : "advance";
      const g = randomHostileGoal();
      u.goalLon = g[0];
      u.goalLat = g[1];
    }
  }

  return units;
};

const STATE_REMARK: Record<BehaviorState, string> = {
  patrol: "patrolling forward",
  engage: "in contact",
  retreat: "withdrawing to base",
  recover: "refit at base",
  circle: "on station, orbit",
  pursue: "vectoring on bandit",
  return: "rtb to orbit",
  push: "advancing on objective",
  evade: "breaking contact",
  advance: "advancing on front",
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Canned FR-04 entry attached to friendlies under jamming. The exact
// numbers don't matter for the simulator — what matters is that the
// attribution layer renders a red badge and the AI panel's formula
// scores against `confidence > 0.5`.
const JAM_FINGERPRINT: FingerprintMatch = {
  tag: "RB-341V",
  name: "Leer-3 GSM/GPS jammer signature",
  confidence: 0.82,
  matchedSignals: ["drop", "dup", "corrupt", "reorder"],
  freqBandMhz: [900, 1900],
  gnssOverlap: "L1/L2",
  rangeKm: 6,
  sectorDeg: 360,
  source: "battle-sim catalog",
  primaryEffect: "GNSS denial + comms degradation",
};

const cleanDetectors = (): Detectors => ({
  temporalAnomaly: false,
  crcPct60s: 0,
  crcBreach: false,
  spatialClass: "clear",
  fingerprint: null,
});

const jammedDetectors = (): Detectors => ({
  temporalAnomaly: true,
  crcPct60s: 0.18,
  crcBreach: true,
  spatialClass: "localized",
  fingerprint: JAM_FINGERPRINT,
});

export const emitFromBattleUnit = (u: BattleUnit): CotEvent => {
  const now = Date.now();
  const ce = lerp(180, 2, u.hp);
  const le = lerp(300, 2, u.hp);
  // Friendlies under active jamming get FR-04 + temporal/CRC chips.
  // BANDITs that are jamming carry their own fingerprint so the badge
  // is visible directly on the aggressor too.
  let detectors: Detectors | undefined;
  if (u.jammed && u.faction === "friendly") {
    detectors = jammedDetectors();
  } else if (u.jamming && u.kind === "uav") {
    detectors = {
      ...cleanDetectors(),
      fingerprint: { ...JAM_FINGERPRINT, confidence: 0.95 },
    };
  }
  const remark = u.jammed
    ? `${u.callsign} JAMMED — ${STATE_REMARK[u.state]} hp=${(u.hp * 100).toFixed(0)}%`
    : `${u.callsign} ${STATE_REMARK[u.state]} hp=${(u.hp * 100).toFixed(0)}%`;
  return enrichCot({
    uid: u.uid,
    cotType: u.cotType,
    sensorType: u.sensorType,
    time: new Date(now).toISOString(),
    start: new Date(now).toISOString(),
    staleAt: new Date(now + 60_000).toISOString(),
    lat: u.lat,
    lon: u.lon,
    hae: u.hae,
    ce,
    le,
    callsign: u.callsign,
    remarks: remark,
    trustScore: u.trust,
    detectors,
  });
};
