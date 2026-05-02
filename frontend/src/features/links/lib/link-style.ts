import type { LinkStatus } from "@/types/cot";

export type RGBA = [number, number, number, number];

const STATUS_COLORS: Record<LinkStatus, RGBA> = {
  healthy: [0, 255, 136, 255],      // Bright cyan-green
  degraded: [255, 215, 0, 255],     // Bright gold
  critical: [255, 107, 53, 255],    // Bright orange-red
  offline: [140, 150, 160, 200],    // Gray
};

export const statusColor = (status: LinkStatus): RGBA =>
  STATUS_COLORS[status];

export const radiusFromConfidence = (confInt: number): number =>
  70 + (1 - confInt) * 100;
