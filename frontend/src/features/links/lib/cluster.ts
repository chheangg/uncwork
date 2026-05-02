import type { LinkStatus } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";
import type { AugmentedEvent } from "../hooks/use-affected-augment";

export type Track = TrackPath<AugmentedEvent>;

export type Cluster = {
  lon: number;
  lat: number;
  count: number;
  status: LinkStatus;
};

export type ClusterResult = {
  singletons: Track[];
  clusters: Cluster[];
};

const STATUS_PRIORITY: Record<LinkStatus, number> = {
  healthy: 0,
  degraded: 1,
  stale: 2,
  critical: 3,
  offline: 4,
};

const worstOf = (a: LinkStatus, b: LinkStatus): LinkStatus =>
  STATUS_PRIORITY[a] >= STATUS_PRIORITY[b] ? a : b;

// Tracks within this many on-screen pixels collapse into a cluster.
const CLUSTER_RADIUS_PX = 56;

// Web Mercator: at zoom z, the world is 256 * 2^z pixels wide, so 1
// pixel maps to (360 / (256 * 2^z)) degrees of longitude. Latitude
// shrinks toward the poles, but for clustering on a city scale the
// lon scale is close enough.
export const clusterPaths = (paths: Track[], zoom: number): ClusterResult => {
  const degPerPx = 360 / (256 * Math.pow(2, zoom));
  const cellDeg = degPerPx * CLUSTER_RADIUS_PX;
  if (cellDeg <= 0 || !Number.isFinite(cellDeg)) {
    return { singletons: paths, clusters: [] };
  }

  const buckets = new Map<string, Track[]>();
  for (const p of paths) {
    const cx = Math.floor(p.latest.lon / cellDeg);
    const cy = Math.floor(p.latest.lat / cellDeg);
    const key = `${cx}|${cy}`;
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }

  const singletons: Track[] = [];
  const clusters: Cluster[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      singletons.push(group[0]!);
      continue;
    }
    let sumLon = 0;
    let sumLat = 0;
    let worst: LinkStatus = "healthy";
    for (const p of group) {
      sumLon += p.latest.lon;
      sumLat += p.latest.lat;
      worst = worstOf(worst, p.latest.status);
    }
    clusters.push({
      lon: sumLon / group.length,
      lat: sumLat / group.length,
      count: group.length,
      status: worst,
    });
  }

  return { singletons, clusters };
};
