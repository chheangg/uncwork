import type { Affiliation, LinkStatus } from "@/types/cot";

export type RGBA = [number, number, number, number];

const STATUS_COLORS: Record<LinkStatus, RGBA> = {
  healthy: [57, 255, 20, 220],
  degraded: [255, 209, 102, 220],
  critical: [255, 80, 80, 240],
  stale: [255, 176, 0, 220],
  offline: [120, 130, 140, 180],
};

const AFFILIATION_FILL: Record<Affiliation, RGBA> = {
  friendly: [88, 166, 255, 200],
  hostile: [255, 58, 58, 200],
  neutral: [120, 220, 160, 200],
  unknown: [220, 220, 220, 180],
  pending: [255, 209, 102, 180],
  assumed: [180, 140, 255, 180],
  suspect: [255, 120, 200, 200],
};

export const statusColor = (status: LinkStatus): RGBA =>
  STATUS_COLORS[status];

export const affiliationFill = (affiliation: Affiliation): RGBA =>
  AFFILIATION_FILL[affiliation];

export const radiusFromConfidence = (confInt: number): number =>
  60 + (1 - confInt) * 90;
