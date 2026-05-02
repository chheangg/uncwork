import type { LinkStatus } from "@/types/cot";

export type RGBA = [number, number, number, number];

// Muted, desaturated palette tuned to read on both the topo basemap
// (green/tan) and the satellite basemap (green/brown/blue) without
// blowing out. Same hue families as before, just dimmer + warmer.
const STATUS_COLORS: Record<LinkStatus, RGBA> = {
  healthy: [108, 180, 132, 235],   // muted sea-green
  degraded: [215, 170, 75, 235],   // muted amber
  critical: [215, 90, 78, 245],    // muted brick-red
  offline: [125, 132, 140, 175],   // slate-gray
};

export const statusColor = (status: LinkStatus): RGBA =>
  STATUS_COLORS[status];

export const radiusFromConfidence = (confInt: number): number =>
  70 + (1 - confInt) * 100;
