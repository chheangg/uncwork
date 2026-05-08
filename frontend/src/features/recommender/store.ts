/**
 * Type contract for the formula-driven recommender. There is no async
 * state to manage — every option is computed deterministically from
 * the live track + neighbors at render time — so this file is just
 * the shape definitions consumed by the panel.
 */

/** One concrete option Adam can take for a single attention-worthy link. */
export type RecommenderOption = {
  /** Imperative-voice action ("Cross-cue with adjacent unit", "RTB"). */
  action: string;
  /** One-sentence reasoning grounded in the live trust + fingerprint. */
  rationale: string;
  /** 0..1 estimated probability this action achieves the operator's intent. */
  successProb: number;
};

/** A single link the recommender wants Adam to attend to. */
export type RecommenderLinkRec = {
  callsign: string;
  /** Why this link earned attention (e.g. "trust 0.42 + LEER3 89%"). */
  concern: string;
  /** Three options ordered best-first by computed successProb. */
  options: RecommenderOption[];
};
