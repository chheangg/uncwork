/**
 * Per-scenario walkthrough script. Each stop fires when scenario
 * elapsed-seconds (wall-clock time minus paused time) crosses
 * `atSec`. The walkthrough driver pauses the backend, flies the
 * camera to `focus`, and shows the popup with title + body. The user
 * clicks ▶ to resume; the driver advances to the next stop.
 *
 * Coordinates are picked from the live scenario data:
 *  - Donetsk friendly AO: 48.46–48.48° N, 37.00–37.05° E
 *  - Team 1 (jammer in UAV): 48.470, 37.020
 *  - Team 3 (collateral in UAV): 48.468, 37.018
 *  - Team 2 (clean in UAV): 48.480, 37.050
 *  - Eagle 1 transit (UAV): 48.480, 37.020 @ 3000 m
 *  - Maneuver fight ground: ~48.464, 37.001
 */
export type Focus = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
};

export type Stop = {
  atSec: number;
  focus: Focus;
  title: string;
  body: string;
};

const FRIENDLY_AO_OVERVIEW: Focus = {
  longitude: 37.025,
  latitude: 48.471,
  zoom: 13.5,
  pitch: 45,
  bearing: 0,
};

const TEAM_1_CLOSE: Focus = {
  longitude: 37.020,
  latitude: 48.470,
  zoom: 16,
  pitch: 55,
  bearing: 20,
};

const TEAM_3_CLOSE: Focus = {
  longitude: 37.018,
  latitude: 48.468,
  zoom: 16,
  pitch: 55,
  bearing: 20,
};

const TEAM_2_CLOSE: Focus = {
  longitude: 37.050,
  latitude: 48.480,
  zoom: 15.5,
  pitch: 50,
  bearing: 200,
};

const MANEUVER_FRONT: Focus = {
  longitude: 37.003,
  latitude: 48.464,
  zoom: 16,
  pitch: 55,
  bearing: 75,
};

const MANEUVER_OVERVIEW: Focus = {
  longitude: 37.005,
  latitude: 48.465,
  zoom: 14.5,
  pitch: 45,
  bearing: 75,
};

export const WALKTHROUGH_SCRIPTS: Record<string, Stop[]> = {
  uav: [
    {
      atSec: 1,
      focus: FRIENDLY_AO_OVERVIEW,
      title: "1 · The picture",
      body: "Hostile drones are in the sector. Three friendly ground teams (Team 1, Team 2, Team 3) and a friendly fixed-wing (Eagle 1) sit on Officer Adam's C2. Team 1 is operating an EW system to jam the incoming drone.",
    },
    {
      atSec: 8,
      focus: TEAM_1_CLOSE,
      title: "2 · Team 1 lights up",
      body: "Running EW shows up on Team 1's own wire — drop, dup, corrupt, reorder. The FR-04 classifier scores the live shape against its catalog and surfaces the closest match as a red badge over Team 1. Team 1's trust score collapses into LOW.",
    },
    {
      atSec: 16,
      focus: TEAM_3_CLOSE,
      title: "3 · Team 3 dragged via blast radius",
      body: "Team 3 sits ~250 m from Team 1, well inside the 500 m neighbor-drag radius. Team 3's own wire is clean, but the algorithm pulls its effective trust toward the worst neighbor in range. Watch Team 3 drop to LOW with no fingerprint of its own.",
    },
    {
      atSec: 24,
      focus: TEAM_2_CLOSE,
      title: "4 · Team 2 + Eagle 1 are clear",
      body: "Team 2 is ~2.5 km from Team 1 — outside the 500 m radius, no drag, trust stays HIGH. Eagle 1 is in the sky, relayed through Team 2, so it inherits Team 2's clean trust. The score gradient is the demo: HIGH = act on, LOW = verify first.",
    },
    {
      atSec: 32,
      focus: FRIENDLY_AO_OVERVIEW,
      title: "5 · How this helps the commander",
      body: "Without this surface, Adam sees one team with bad comms and assumes the rest are fine. With it, he sees a fingerprint over Team 1 and a LOW score on Team 3 — same map, two pieces of evidence telling him exactly which feeds to act on and which to discount before he commits.",
    },
  ],
  maneuver: [
    // Stops are timed against the maneuver ndxml beats (one tick =
    // 0.25 atSec at any speed):
    //   frame 0   (atSec 0)   — TEAM-1, TEAM-2 advancing
    //   frame 48  (atSec 12)  — JAM_START_TICK kicks in
    //   frame 70  (atSec 17.5) — TEAM-2 FIRES MISSILE remark
    //   frame 150 (atSec 37.5) — TEAM-2 KIA frames begin
    //   frame 240 (atSec 60)  — scenario file end (after padding)
    {
      atSec: 1,
      focus: MANEUVER_OVERVIEW,
      title: "1 · The operation",
      body: "Team 1 and Team 2 are in an operation under Officer Adam's watch. The plan: Team 1 suppresses, Team 2 flanks. Both maintain comms with each other and with Adam.",
    },
    {
      atSec: 7,
      focus: MANEUVER_FRONT,
      title: "2 · The flank moves",
      body: "Team 2 begins advancing toward the flanking position. Trust scores still HIGH on both teams. Adam watches the picture come together.",
    },
    {
      atSec: 13,
      focus: MANEUVER_FRONT,
      title: "3 · Interference begins",
      body: "As Team 2 closes on the flank, its wire shape changes — drops, dups, corrupts ramp up. The FR-04 classifier surfaces a fingerprint badge over Team 2; trust collapses into LOW. The exact catalog tag depends on the live shape — what matters is that Adam sees something is wrong before the next move.",
    },
    {
      atSec: 18,
      focus: MANEUVER_FRONT,
      title: "4 · Missile away",
      body: "Team 2 fires a GPS-guided missile at the enemy position. With prime targeting conditions, it should hit. It misses — the same EW that wrecked Team 2's comms also corrupted the missile's guidance.",
    },
    {
      atSec: 38,
      focus: MANEUVER_OVERVIEW,
      title: "5 · The collapse",
      body: "Team 1's trust drags down via FR-03 neighbor pass — they're well inside Team 2's blast radius. The flank fails. Both teams take casualties and withdraw. Without this view, Adam saw a chain of bad luck. With it, he sees one shared cause.",
    },
    {
      atSec: 45,
      focus: MANEUVER_OVERVIEW,
      title: "6 · How this helps the commander",
      body: "Three pieces of evidence within seconds: fingerprint over Team 2, Team 2's trust LOW, Team 1's trust dragging. Adam pulls the missile launch, repositions Team 2, calls in EW support. Same teams, same enemy, the operation survives. That is the difference this surface makes.",
    },
  ],
};

export const scriptFor = (scenario: string | null): Stop[] =>
  (scenario && WALKTHROUGH_SCRIPTS[scenario]) || [];
