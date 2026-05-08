/**
 * Per-scenario walkthrough script. Each stop fires when scenario
 * elapsed-seconds (wall-clock time minus paused time) crosses
 * `atSec`. The walkthrough driver pauses the backend, flies the
 * camera to `focus`, and shows the popup with title + body. The user
 * clicks ▶ to resume; the driver advances to the next stop.
 *
 * Camera-smoothness rules (learned the hard way):
 *  - When `selectCallsign` is set, the driver overrides focus.lat/lon
 *    with the track's live position. The App's camera-follow effect
 *    re-centers on the selected track every animation tick, so any
 *    mismatch shows up as a hard jump on the next frame. Hardcoded
 *    focus.lat/lon are only used for stops without a selection.
 *  - Keep `bearing` consistent across stops. Flipping bearing 0→200
 *    between adjacent stops whips the camera and is visually broken.
 *  - Keep `zoom` deltas small (≤2) and `pitch` deltas small (≤10).
 *  - Don't auto-select moving tracks (Eagle 1, hostile UAVs) — the
 *    follow effect chases them and the popup feels seasick.
 *
 * Donetsk friendly AO geometry:
 *  - Team 1 (jammer in UAV):       48.470, 37.020 — stationary
 *  - Team 3 (collateral in UAV):   48.468, 37.018 — stationary
 *  - Team 2 (clean in UAV):        48.480, 37.050 — stationary
 *  - Eagle 1 transit (UAV):        48.480, 37.020 @ 3000 m — moving E
 *  - Maneuver fight ground:        ~48.464, 37.001
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
  /**
   * Callsign of the link the operator should be looking at during this
   * stop. When set, the walkthrough driver opens that link's detail
   * panel; the floating AI recommender panel renders alongside it with
   * formula-scored options.
   */
  selectCallsign?: string;
};

// One stable bearing across the whole UAV walkthrough — flipping it
// per stop was the loudest source of camera whip in the prior script.
const UAV_BEARING = 0;
// One pitch for overview shots, one for close-ups. Two values, both
// gentle, no per-stop variance.
const UAV_OVERVIEW_PITCH = 45;
const UAV_CLOSE_PITCH = 50;
// Two zoom levels: AO overview, single-team close-up.
const UAV_OVERVIEW_ZOOM = 13.5;
const UAV_CLOSE_ZOOM = 15;

const UAV_AO_OVERVIEW: Focus = {
  // Centered between Team 1 (37.020,48.470) and Team 2 (37.050,48.480)
  // so the overview frames every friendly without favoring one side.
  longitude: 37.035,
  latitude: 48.475,
  zoom: UAV_OVERVIEW_ZOOM,
  pitch: UAV_OVERVIEW_PITCH,
  bearing: UAV_BEARING,
};

// Close-up focuses are placeholders — the driver overrides lat/lon
// with the selected track's live position. Only zoom/pitch/bearing
// here actually take effect, and we keep them identical across the
// three close-ups so adjacent stops only translate the camera.
const UAV_TEAM_CLOSE: Focus = {
  longitude: 37.020,
  latitude: 48.470,
  zoom: UAV_CLOSE_ZOOM,
  pitch: UAV_CLOSE_PITCH,
  bearing: UAV_BEARING,
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
  // UAV walkthrough rebuilt from scratch for camera smoothness.
  // - Single bearing (0°), single overview-zoom, single close-up zoom.
  // - Trust EMA settles at ~12 frames (TRUST_ALPHA=0.08), 4 frames per
  //   atSec — by atSec 4 trust is visibly LOW; by 6 it's stable.
  // - Stop 4 selects TEAM-2 (stationary) instead of EAGLE-1 (140 m/s
  //   eastbound). Selecting a fast-moving track makes the camera-
  //   follow effect chase it during the held popup.
  uav: [
    {
      atSec: 2,
      focus: UAV_AO_OVERVIEW,
      title: "1 · The picture",
      body: "Hostile drones are in the sector. Three friendly ground teams (Team 1, Team 2, Team 3) and a friendly fixed-wing (Eagle 1) sit on Officer Adam's C2. Team 1 is operating an EW system to jam the incoming drone — that's about to show up on the wire.",
    },
    {
      atSec: 7,
      focus: UAV_TEAM_CLOSE,
      title: "2 · Team 1 lights up",
      body: "Team 1's own wire is corrupting — drop, dup, corrupt, reorder. FR-04 surfaces a red fingerprint badge; trust collapses to LOW. The AI panel on the left scores 'switch to backup comms' and 'cross-cue with adjacent unit' above 'continue, trust feed' — and the bars move with the live trust + fingerprint, not a canned ranking.",
      selectCallsign: "TEAM-1",
    },
    {
      atSec: 13,
      focus: UAV_TEAM_CLOSE,
      title: "3 · Team 3 dragged via blast radius",
      body: "Team 3 sits ~250 m from Team 1, inside the 500 m neighbor-drag radius. Its own wire is clean — no fingerprint — but trust drags to LOW. The AI panel sees a clean shape behind a low score and ranks 'verify before committing' on top. A flat Palantir/Anduril console wouldn't even tell Adam the trust drop is real.",
      selectCallsign: "TEAM-3",
    },
    {
      atSec: 19,
      focus: UAV_TEAM_CLOSE,
      title: "4 · Team 2 is clear",
      body: "Team 2 is ~2.5 km from Team 1 — outside the radius, no drag, trust stays HIGH. Eagle 1 (in the sky) is relayed through Team 2 and inherits its clean trust. The AI panel flips: 'continue assault, trust feed' moves to the top, 'switch comms' drops. Same scoring formula, different evidence.",
      selectCallsign: "TEAM-2",
    },
    {
      atSec: 25,
      focus: UAV_AO_OVERVIEW,
      title: "5 · How this helps the commander",
      body: "Naive view (Palantir / Anduril without this layer): all four friendlies show GREEN, Adam acts on every feed equally. With this layer: a fingerprint over Team 1, a low score on Team 3, and a per-link AI panel that scores actions against those signals — telling Adam which feeds to act on and which to discount before he commits.",
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
      title: "3 · The link starts to lie",
      body: "Team 2's wire shape changes — drops, dups, corrupts ramp up. FR-04 surfaces a fingerprint badge; trust collapses into LOW. The AI panel reads the live trust score and fingerprint match and ranks 'switch to backup comms / cross-cue' above 'continue assault, trust feed' with a success probability for each. This is the moment a naive interface would still be GREEN.",
      selectCallsign: "TEAM-2",
    },
    {
      atSec: 18,
      focus: MANEUVER_FRONT,
      title: "4 · Missile away (the option Adam took without us)",
      body: "Team 2 fires a GPS-guided missile. With prime targeting it should hit. It misses — the same EW that wrecked Team 2's comms corrupted the missile's guidance. The bottom-ranked option ('continue, trust feed') from stop 3 was the one that played out without the layer. Same panel — read the bars now that the consequence is visible.",
      selectCallsign: "TEAM-2",
    },
    {
      atSec: 38,
      focus: MANEUVER_OVERVIEW,
      title: "5 · The collapse",
      body: "Team 1's trust drags down via FR-03 neighbor pass — well inside Team 2's blast radius. The flank fails. The AI panel now sees a low-trust feed with no fingerprint of its own — its top option becomes 'verify before re-engaging' rather than blindly trusting the link.",
      selectCallsign: "TEAM-1",
    },
    {
      atSec: 45,
      focus: MANEUVER_OVERVIEW,
      title: "6 · How this helps the commander",
      body: "Naive Palantir/Anduril view: a chain of bad luck. With this layer: fingerprint over Team 2, Team 2 trust LOW, Team 1 dragging — and a floating AI panel that gives Adam ranked actions with success probabilities scored against trust and fingerprint. Same teams, same enemy, the operation survives.",
    },
  ],
};

export const scriptFor = (scenario: string | null): Stop[] =>
  (scenario && WALKTHROUGH_SCRIPTS[scenario]) || [];
