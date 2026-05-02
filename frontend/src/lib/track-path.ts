import type { CotEvent } from "@/types/cot";

export type TrackPath<E extends CotEvent = CotEvent> = {
  uid: string;
  path: [number, number][];
  timestamps: number[];
  latest: E;
};

// Linear interpolation between the two history samples that bracket
// `t`. If `t` is before the first sample, return the first; if after
// the last, return the last (no extrapolation -- when data stops, the
// icon stops where it last was).
export const positionAt = (
  path: [number, number][],
  timestamps: number[],
  t: number,
): [number, number] => {
  const n = path.length;
  if (n === 0) return [0, 0];
  if (n === 1) return path[0]!;
  if (t <= timestamps[0]!) return path[0]!;
  if (t >= timestamps[n - 1]!) return path[n - 1]!;

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid]! <= t) lo = mid;
    else hi = mid;
  }
  const t0 = timestamps[lo]!;
  const t1 = timestamps[hi]!;
  const span = t1 - t0;
  if (span <= 0) return path[hi]!;
  const u = (t - t0) / span;
  const [x0, y0] = path[lo]!;
  const [x1, y1] = path[hi]!;
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
};
