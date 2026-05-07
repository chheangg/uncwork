import { create } from "zustand";

/** One concrete option Adam can take for a single attention-worthy link. */
export type RecommenderOption = {
  /** Imperative-voice action ("Pull missile launch", "Reposition Team 2"). */
  action: string;
  /** One-sentence reasoning grounded in the supplied state. */
  rationale: string;
  /** 0..1 estimated probability this action achieves the operator's intent. */
  successProb: number;
};

/** A single link the model wants Adam to attend to. */
export type RecommenderLinkRec = {
  /** Callsign that must match a live track exactly (e.g. "TEAM-2"). */
  callsign: string;
  /** Why this link earned attention (e.g. "trust 0.42 + LEER3 89% HIGH"). */
  concern: string;
  /** 2–3 ordered options, best first. */
  options: RecommenderOption[];
};

/** The full structured recommendation surface. */
export type RecommenderResult = {
  links: RecommenderLinkRec[];
  /** ≤ 2 sentences tying the picture together. */
  summary: string;
  receivedAtMs: number;
  scenario: string;
};

type RecommenderStore = {
  loading: boolean;
  result: RecommenderResult | null;
  error: string | null;
  setLoading: (v: boolean) => void;
  setResult: (r: RecommenderResult | null) => void;
  setError: (e: string | null) => void;
};

export const useRecommenderStore = create<RecommenderStore>((set) => ({
  loading: false,
  result: null,
  error: null,
  setLoading: (loading) => set({ loading }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),
}));
