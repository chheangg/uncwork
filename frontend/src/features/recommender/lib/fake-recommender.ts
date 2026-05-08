import type { CotEvent, Dimension } from "@/types/cot";
import type { RecommenderLinkRec, RecommenderOption } from "../store";

/**
 * Formula-driven recommender. The action templates and rationale text
 * are canned, but the success probability for each option is computed
 * deterministically from the link's live trust score and FR-04
 * fingerprint confidence — so the bars genuinely move when the wire
 * shape changes, even though the verbs do not.
 *
 * Three archetypes per link, ordered after scoring:
 *   - VERIFY:  pay a small cost to confirm the feed before committing.
 *              Wins when evidence of deception is high (low trust or
 *              high fingerprint), still positive-EV when evidence is
 *              low because the cost is small.
 *   - MITIGATE: switch comms / reposition / RTB / hand off. Wins when
 *              the fingerprint match is strong — the fix targets the
 *              EW signature directly.
 *   - ACT:     trust the feed and execute the obvious action (continue
 *              assault, engage, fly the profile). The "trap" option:
 *              high success when evidence is low, collapses fast as
 *              evidence grows.
 *
 * Score functions are picked so that, with low evidence, ACT > VERIFY
 * > MITIGATE; with high evidence, VERIFY > MITIGATE > ACT — matching
 * the trust-and-fingerprint story the C2 surface is selling.
 */

export type Archetype = "verify" | "mitigate" | "act";

type ActionSet = Record<Archetype, { action: string; rationale: string }>;

const FRIENDLY_GROUND: ActionSet = {
  verify: {
    action: "Cross-cue with adjacent ground unit",
    rationale:
      "Pull a second source on this team's position before committing — confirms or breaks the feed without reaching for the kinetic option.",
  },
  mitigate: {
    action: "Switch to backup comms / reposition out of EW range",
    rationale:
      "Targets the wire-shape signature directly — moves the team to a frequency or location the jammer is not engineered for.",
  },
  act: {
    action: "Continue assault, trust current feed",
    rationale:
      "Treat the link as authoritative and execute the planned action on the current picture.",
  },
};

const FRIENDLY_AIR: ActionSet = {
  verify: {
    action: "Hand off to alternate sensor (radar + EO/IR)",
    rationale:
      "Bring an independent sensor onto the same track — checks the link's report against a second observation chain.",
  },
  mitigate: {
    action: "Vector off, RTB to safe airfield",
    rationale:
      "Pull the platform out of the EW envelope — preserves airframe and removes it from the deception surface.",
  },
  act: {
    action: "Continue mission profile",
    rationale:
      "Hold heading and altitude on the planned profile, treating the live feed as ground-truth.",
  },
};

const HOSTILE: ActionSet = {
  verify: {
    action: "Cue counter-EW for confirmation",
    rationale:
      "Spin up the counter-EW package to validate the track before committing weapons — slower but distinguishes a real threat from a spoofed one.",
  },
  mitigate: {
    action: "Engage with kinetic at degraded confidence",
    rationale:
      "Commit a weapon even though the link is suspect — the threat may be real and waiting for verification could cost the window.",
  },
  act: {
    action: "Treat as confirmed hostile, engage",
    rationale:
      "Trust the track classification and prosecute the engagement on the current feed.",
  },
};

const SENSOR: ActionSet = {
  verify: {
    action: "Cross-cue another sensor",
    rationale:
      "Run a second sensor against the same volume — separates a real anomaly from sensor degradation.",
  },
  mitigate: {
    action: "Mark sensor as unreliable, reduce its weight",
    rationale:
      "Down-weight this feed in the fusion picture so a degraded sensor doesn't poison downstream tracks.",
  },
  act: {
    action: "Continue trusting sensor output",
    rationale:
      "Accept the sensor's report at full weight and let downstream consumers act on it.",
  },
};

const NEUTRAL_OR_UNKNOWN: ActionSet = {
  verify: {
    action: "Maintain track, request positive ID",
    rationale:
      "Keep the track on the picture but route to ID cell before changing classification — the wire is suspect.",
  },
  mitigate: {
    action: "Move to suspect classification, alert nearby units",
    rationale:
      "Promote the track up the threat ladder so neighboring units take it into account without committing weapons.",
  },
  act: {
    action: "Hold current classification, no change",
    rationale:
      "Leave the track as-is and continue normal monitoring on the current feed.",
  },
};

const parseAffiliation = (cotType: string): "friendly" | "hostile" | "other" => {
  const code = cotType.split("-")[1]?.toLowerCase() ?? "u";
  if (code === "f" || code === "a") return "friendly";
  if (code === "h" || code === "j" || code === "k" || code === "s") return "hostile";
  return "other";
};

const pickActionSet = (
  affiliation: "friendly" | "hostile" | "other",
  dimension: Dimension,
): ActionSet => {
  if (affiliation === "hostile") return HOSTILE;
  if (dimension === "sensor") return SENSOR;
  if (affiliation === "friendly") {
    if (dimension === "air" || dimension === "space") return FRIENDLY_AIR;
    return FRIENDLY_GROUND;
  }
  return NEUTRAL_OR_UNKNOWN;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Score functions. `evidence` is the model's belief that the link is
 * being deceived — a weighted sum of trust deficit and fingerprint
 * confidence. Each archetype's probability is a tuned linear blend.
 */
const scoreFor = (
  archetype: Archetype,
  trust: number,
  fp: number,
): number => {
  const evidence = clamp01((1 - trust) * 0.55 + fp * 0.55);
  switch (archetype) {
    case "verify":
      // Cautious option: floor at 0.55, climbs to 0.95 with evidence.
      return clamp01(0.55 + 0.4 * evidence);
    case "mitigate":
      // Targeted fix: peaks when fingerprint is strong, mild penalty
      // for low trust without a fingerprint (you're guessing).
      return clamp01(0.45 + 0.45 * fp - 0.1 * (1 - trust));
    case "act":
      // Trap option: high when evidence low, collapses fast as it
      // climbs. Anchors the contrast in the bar chart.
      return clamp01(0.9 - 0.85 * evidence);
  }
};

const formatRationale = (
  base: string,
  e: CotEvent,
  trust: number,
  fp: number,
): string => {
  const trustPct = Math.round(trust * 100);
  const fpTag = e.detectors?.fingerprint?.tag?.toUpperCase();
  const fpPct = Math.round(fp * 100);
  const cite =
    fp >= 0.5 && fpTag
      ? `[trust ${trustPct}% · ${fpTag} ${fpPct}%]`
      : `[trust ${trustPct}% · no fingerprint]`;
  return `${base} ${cite}`;
};

const concernFor = (e: CotEvent, trust: number, fp: number): string => {
  if (fp >= 0.5) {
    const tag = e.detectors?.fingerprint?.tag?.toUpperCase() ?? "FR-04";
    return `${tag} match ${Math.round(fp * 100)}% — link likely deceived.`;
  }
  if (trust < 0.5) {
    return `trust ${Math.round(trust * 100)}% — clean wire but neighbor-dragged.`;
  }
  if (e.stale) {
    return `delivery stale — feed is correct but late.`;
  }
  return `trust ${Math.round(trust * 100)}% — feed nominal, no fingerprint.`;
};

const summaryFor = (trust: number, fp: number): string => {
  if (fp >= 0.5) {
    return "Fingerprint + trust drop both flag this link as deceived. Without this layer Adam would be acting on a green status icon with no idea the feed was lying.";
  }
  if (trust < 0.5) {
    return "Trust collapsed via neighbor-drag even without a local fingerprint — the layer surfaces collateral EW damage that a flat console would miss.";
  }
  return "Link is nominal on every signal we measure — the recommender greenlights aggressive options to show the contrast against the LOW-trust panels.";
};

/**
 * Build the per-link recommendation entry. Ordered by successProb
 * descending so the top option is always the recommended one.
 */
export const recommendForLink = (
  e: CotEvent,
): { rec: RecommenderLinkRec; summary: string } => {
  const trust = clamp01(e.trustScore);
  const fp = clamp01(e.detectors?.fingerprint?.confidence ?? 0);
  const affiliation = parseAffiliation(e.cotType);
  const set = pickActionSet(affiliation, e.dimension);

  const archetypes: Archetype[] = ["verify", "mitigate", "act"];
  const options: RecommenderOption[] = archetypes
    .map((arch) => ({
      action: set[arch].action,
      rationale: formatRationale(set[arch].rationale, e, trust, fp),
      successProb: scoreFor(arch, trust, fp),
    }))
    .sort((a, b) => b.successProb - a.successProb);

  const callsign = e.callsign ?? e.uid;
  return {
    rec: {
      callsign,
      concern: concernFor(e, trust, fp),
      options,
    },
    summary: summaryFor(trust, fp),
  };
};
