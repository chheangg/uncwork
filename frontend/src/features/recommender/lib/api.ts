import { httpUrl } from "@/config/env";
import type { CotEvent, FingerprintMatch } from "@/types/cot";
import type {
  RecommenderLinkRec,
  RecommenderOption,
} from "../store";

const AFFIL_CODE_TO_LABEL: Record<string, string> = {
  f: "friendly",
  h: "hostile",
  u: "unknown",
  n: "neutral",
  a: "assumed-friend",
  s: "suspect",
  j: "joker",
  k: "faker",
};

const parseAffiliation = (cotType: string): string => {
  const code = cotType.split("-")[1] ?? "u";
  return AFFIL_CODE_TO_LABEL[code.toLowerCase()] ?? "unknown";
};

// Wire shape sent to the backend. We flatten only the fields the
// recommender prompt cares about so we are not leaking the full
// CotEvent (with its derived flags + augmentation) over the wire.
type EventWire = {
  uid: string;
  callsign: string | null;
  dimension: string;
  affiliation: string;
  sensorType: string;
  status: string;
  trustScore: number;
  stale: boolean;
  lat: number;
  lon: number;
  fingerprint:
    | (Pick<
        FingerprintMatch,
        "tag" | "name" | "confidence" | "rangeKm"
      > & { matchedSignals: string[] })
    | null;
};

const flatten = (e: CotEvent): EventWire => ({
  uid: e.uid,
  callsign: e.callsign ?? null,
  dimension: e.dimension,
  affiliation: parseAffiliation(e.cotType),
  sensorType: e.sensorType,
  status: e.status,
  trustScore: e.trustScore,
  stale: e.stale,
  lat: e.lat,
  lon: e.lon,
  fingerprint: e.detectors?.fingerprint
    ? {
        tag: e.detectors.fingerprint.tag,
        name: e.detectors.fingerprint.name,
        confidence: e.detectors.fingerprint.confidence,
        rangeKm: e.detectors.fingerprint.rangeKm,
        matchedSignals: e.detectors.fingerprint.matchedSignals,
      }
    : null,
});

type RecommendApiResponse = {
  links: RecommenderLinkRec[];
  summary: string;
};

export const requestRecommendation = async (params: {
  scenario: string;
  events: CotEvent[];
  signal?: AbortSignal;
}): Promise<RecommendApiResponse> => {
  const { scenario, events, signal } = params;
  const body = {
    scenario,
    events: events.map(flatten),
  };
  const res = await fetch(httpUrl("/recommend"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as RecommendApiResponse;
  // Defensive: ensure shape is sane and probabilities are clamped.
  const links: RecommenderLinkRec[] = (
    Array.isArray(data.links) ? data.links : []
  ).map((l) => ({
    callsign: String(l.callsign ?? ""),
    concern: String(l.concern ?? ""),
    options: (Array.isArray(l.options) ? l.options : []).map<RecommenderOption>(
      (o) => ({
        action: String(o.action ?? ""),
        rationale: String(o.rationale ?? ""),
        successProb: Math.max(
          0,
          Math.min(1, Number(o.successProb ?? 0)),
        ),
      }),
    ),
  }));
  return {
    links,
    summary: typeof data.summary === "string" ? data.summary : "",
  };
};
