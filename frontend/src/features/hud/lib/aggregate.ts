import type { CotEvent, LinkStatus } from "@/types/cot";

export type StatusCounts = Record<LinkStatus, number>;

const STATUS_KEYS: LinkStatus[] = [
  "healthy",
  "degraded",
  "critical",
  "offline",
];

const emptyStatus = (): StatusCounts =>
  Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as StatusCounts;

export const countByStatus = (events: CotEvent[]): StatusCounts => {
  const counts = emptyStatus();
  for (const e of events) counts[e.status] += 1;
  return counts;
};

export const countStale = (events: CotEvent[]): number => {
  let n = 0;
  for (const e of events) if (e.stale) n += 1;
  return n;
};

export const meanTrust = (events: CotEvent[]): number => {
  if (events.length === 0) return 0;
  let sum = 0;
  for (const e of events) sum += e.trustScore;
  return sum / events.length;
};
