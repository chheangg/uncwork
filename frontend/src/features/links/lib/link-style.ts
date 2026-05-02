import type { LinkStatus } from "@/types/cot";

export type RGBA = [number, number, number, number];

const STATUS_COLORS: Record<LinkStatus, RGBA> = {
  healthy: [74, 222, 128, 220],
  degraded: [255, 209, 102, 220],
  critical: [255, 20, 20, 240],
  stale: [255, 140, 66, 220],
  offline: [120, 110, 110, 180],
};

export const statusColor = (status: LinkStatus): RGBA =>
  STATUS_COLORS[status];

export const radiusFromConfidence = (confInt: number): number =>
  60 + (1 - confInt) * 90;
