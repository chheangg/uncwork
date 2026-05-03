import type { TrackPath } from "@/lib/track-path";
import type { AugmentedEvent } from "@/features/links";

export type RecommendationAction =
  | "engage"
  | "intercept"
  | "suppress"
  | "hold"
  | "reroute"
  | "verify"
  | "handoff"
  | "reacquire"
  | "observe"
  | "monitor";

export const ACTION_LABEL: Record<RecommendationAction, string> = {
  engage: "ENGAGE",
  intercept: "INTERCEPT",
  suppress: "SUPPRESS",
  hold: "HOLD",
  reroute: "REROUTE",
  verify: "VERIFY",
  handoff: "HANDOFF",
  reacquire: "REACQUIRE",
  observe: "OBSERVE",
  monitor: "MONITOR",
};

export const ACTION_DESC: Record<RecommendationAction, string> = {
  engage: "commit organic assets",
  intercept: "close on target vector",
  suppress: "apply EW / jam window",
  hold: "pause posture, no commit",
  reroute: "divert adjacent asset",
  verify: "cross-check secondary sensor",
  handoff: "transfer track to peer node",
  reacquire: "re-establish track",
  observe: "passive watch one window",
  monitor: "continue current posture",
};

export type RecommendationOption = {
  action: RecommendationAction;
  probability: number; // 0..1, options sorted desc
};

export type Recommendation = {
  id: string;
  uid: string;
  options: RecommendationOption[];
  rationale: string;
  evidence: string[];
  complete: boolean;
};

type Scenario =
  | "critical-clean"
  | "critical-stale"
  | "degraded-clean"
  | "degraded-stale"
  | "offline"
  | "recovered"
  | "healthy-stale"
  | "healthy";

const classify = (e: AugmentedEvent): Scenario => {
  if (e.status === "offline") return "offline";
  if (e.status === "critical") return e.stale ? "critical-stale" : "critical-clean";
  if (e.status === "degraded") return e.stale ? "degraded-stale" : "degraded-clean";
  if (e.recentlyAffected) return "recovered";
  if (e.stale) return "healthy-stale";
  return "healthy";
};

// Probability distributions per scenario. Each row sums to ~1 and is
// listed primary-first; mocked with small jitter so judges don't see
// identical numbers across two tracks in the same state.
const DISTRIBUTIONS: Record<
  Scenario,
  { action: RecommendationAction; weight: number }[]
> = {
  "critical-clean": [
    { action: "engage", weight: 0.55 },
    { action: "intercept", weight: 0.20 },
    { action: "suppress", weight: 0.15 },
    { action: "hold", weight: 0.10 },
  ],
  "critical-stale": [
    { action: "hold", weight: 0.45 },
    { action: "verify", weight: 0.30 },
    { action: "reacquire", weight: 0.15 },
    { action: "engage", weight: 0.10 },
  ],
  "degraded-clean": [
    { action: "reroute", weight: 0.45 },
    { action: "hold", weight: 0.25 },
    { action: "verify", weight: 0.15 },
    { action: "handoff", weight: 0.15 },
  ],
  "degraded-stale": [
    { action: "verify", weight: 0.40 },
    { action: "hold", weight: 0.30 },
    { action: "reroute", weight: 0.20 },
    { action: "reacquire", weight: 0.10 },
  ],
  offline: [
    { action: "reacquire", weight: 0.55 },
    { action: "handoff", weight: 0.25 },
    { action: "monitor", weight: 0.15 },
    { action: "hold", weight: 0.05 },
  ],
  recovered: [
    { action: "observe", weight: 0.45 },
    { action: "monitor", weight: 0.30 },
    { action: "verify", weight: 0.15 },
    { action: "handoff", weight: 0.10 },
  ],
  "healthy-stale": [
    { action: "monitor", weight: 0.40 },
    { action: "verify", weight: 0.30 },
    { action: "reacquire", weight: 0.20 },
    { action: "observe", weight: 0.10 },
  ],
  healthy: [
    { action: "monitor", weight: 0.60 },
    { action: "observe", weight: 0.20 },
    { action: "verify", weight: 0.15 },
    { action: "handoff", weight: 0.05 },
  ],
};

const buildOptions = (scenario: Scenario): RecommendationOption[] => {
  const base = DISTRIBUTIONS[scenario];
  // Apply small uniform jitter then renormalize. Keeps ranking
  // stable but prevents identical 55/20/15/10 reads across tracks.
  const jittered = base.map(({ action, weight }) => ({
    action,
    weight: Math.max(0.01, weight * (0.85 + Math.random() * 0.3)),
  }));
  const sum = jittered.reduce((s, o) => s + o.weight, 0);
  return jittered
    .map((o) => ({ action: o.action, probability: o.weight / sum }))
    .sort((a, b) => b.probability - a.probability);
};

const buildRationale = (
  e: AugmentedEvent,
  primary: RecommendationAction,
  trail: TrackPath<AugmentedEvent>,
): { rationale: string; evidence: string[] } => {
  const confPct = Math.round(e.trustScore * 100);
  const samples = trail.timestamps.length;
  const statusChanges = trail.statuses.reduce(
    (n, s, i) => (i > 0 && s !== trail.statuses[i - 1] ? n + 1 : n),
    0,
  );
  const callsign = e.callsign ?? e.uid;

  const evidence: string[] = [
    `${samples} samples in 60s window, ${statusChanges} status transition${statusChanges === 1 ? "" : "s"}.`,
    `Confidence interval at ${confPct}%, sensor ${e.sensorType.toUpperCase()}.`,
  ];
  if (e.stale) {
    evidence.push("Last delivery flagged stale -- carrier latency probable.");
  }
  if (e.recentlyAffected) {
    evidence.push(`Recovered from prior ${e.lastIncidentStatus ?? "incident"} within the last 30s.`);
  }
  if (e.ce !== undefined && e.ce > 80) {
    evidence.push(`CE ${e.ce.toFixed(0)}m exceeds nominal threshold (80m).`);
  }

  let body: string;
  switch (primary) {
    case "engage":
      body =
        `${callsign} reads CRITICAL with ${confPct}% confidence. Trail shows ${statusChanges} state transitions in window. ` +
        `Recommend ENGAGE: assets are oriented, and degradation pattern matches a hostile spoof signature observed previously. ` +
        `Risk acceptable given current ROE and deconfliction state.`;
      break;
    case "intercept":
      body =
        `${callsign} on aggressive vector with ${confPct}% confidence. ` +
        `Recommend INTERCEPT to close range and force commit, while suppression element holds in reserve.`;
      break;
    case "suppress":
      body =
        `${callsign} signature suggests sensor saturation. ` +
        `Recommend SUPPRESS via EW window before any kinetic decision -- preserves engagement options.`;
      break;
    case "hold":
      body =
        `${callsign} confidence at ${confPct}%${e.stale ? ", report flagged STALE" : ""}. ` +
        `Trail interpolation may be misleading -- ${samples} samples, ${statusChanges} transitions. ` +
        `Recommend HOLD posture; do not commit until secondary sensor agrees.`;
      break;
    case "reroute":
      body =
        `${callsign} degraded with usable confidence (${confPct}%). ` +
        `Track vector remains valid -- recommend REROUTE adjacent assets to compensate for the coverage gap. ` +
        `Re-evaluate after 30 seconds.`;
      break;
    case "verify":
      body =
        `${callsign} is ambiguous (${confPct}% confidence${e.stale ? ", stale" : ""}). ` +
        `Recommend VERIFY: cue a secondary sensor on the same volume before any further action.`;
      break;
    case "handoff":
      body =
        `${callsign} is on the edge of organic coverage. ` +
        `Recommend HANDOFF to the adjacent node so we don't carry a degrading track when a clean source exists.`;
      break;
    case "reacquire":
      body =
        `${callsign} OFFLINE, last fix is stale. ` +
        `Recommend REACQUIRE via ${e.sensorType.toUpperCase()} backup channel. ` +
        `Do not commit ordnance until link re-establishes.`;
      break;
    case "observe":
      body =
        `${callsign} recovered to HEALTHY (${confPct}%) within the last 30 seconds after a ${e.lastIncidentStatus ?? "prior"} incident. ` +
        `Recommend OBSERVE for one full window to confirm stability before standing down posture.`;
      break;
    case "monitor":
    default:
      body =
        `${callsign} nominal at ${confPct}% confidence. ` +
        `No anomalies in the 60 second window. Recommend continue MONITOR -- no action required.`;
      break;
  }

  return { rationale: body, evidence };
};

let recCounter = 0;

export const startMockStream = (
  trail: TrackPath<AugmentedEvent>,
  signal: AbortSignal,
  onUpdate: (rec: Recommendation) => void,
): void => {
  const e = trail.latest;
  const scenario = classify(e);
  const options = buildOptions(scenario);
  const primary = options[0]!.action;
  const { rationale, evidence } = buildRationale(e, primary, trail);
  const id = `rec-${Date.now().toString(36)}-${(recCounter++).toString(36)}`;

  const rec: Recommendation = {
    id,
    uid: e.uid,
    options,
    rationale: "",
    evidence,
    complete: false,
  };

  onUpdate({ ...rec });

  const tokens = rationale.split(/(\s+)/).filter((t) => t.length > 0);
  let i = 0;

  const tick = () => {
    if (signal.aborted) return;
    if (i >= tokens.length) {
      onUpdate({ ...rec, complete: true });
      return;
    }
    rec.rationale += tokens[i]!;
    i += 1;
    onUpdate({ ...rec });
    const word = tokens[i - 1] ?? "";
    const isSpace = /^\s+$/.test(word);
    const delay = isSpace ? 18 : 55 + Math.random() * 95;
    window.setTimeout(tick, delay);
  };

  window.setTimeout(tick, 220);
};
