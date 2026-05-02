import type { Affiliation, CotEvent, LinkStatus } from "@/types/cot";

export type StatusCounts = Record<LinkStatus, number>;
export type AffiliationCounts = Record<Affiliation, number>;

const STATUS_KEYS: LinkStatus[] = [
  "healthy",
  "degraded",
  "critical",
  "offline",
];
const AFFILIATION_KEYS: Affiliation[] = [
  "friendly",
  "hostile",
  "neutral",
  "unknown",
  "pending",
  "assumed",
  "suspect",
];

const emptyStatus = (): StatusCounts =>
  Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as StatusCounts;

const emptyAffiliation = (): AffiliationCounts =>
  Object.fromEntries(AFFILIATION_KEYS.map((k) => [k, 0])) as AffiliationCounts;

export const countByStatus = (events: CotEvent[]): StatusCounts => {
  const counts = emptyStatus();
  for (const e of events) counts[e.status] += 1;
  return counts;
};

export const countByAffiliation = (events: CotEvent[]): AffiliationCounts => {
  const counts = emptyAffiliation();
  for (const e of events) counts[e.affiliation] += 1;
  return counts;
};

export const countStale = (events: CotEvent[]): number => {
  let n = 0;
  for (const e of events) if (e.stale) n += 1;
  return n;
};

export const meanConfidence = (events: CotEvent[]): number => {
  if (events.length === 0) return 0;
  let sum = 0;
  for (const e of events) sum += e.confInt;
  return sum / events.length;
};
