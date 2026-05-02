import type { Bbox } from "@/types/bbox";

export const inBbox = (lat: number, lon: number, b: Bbox): boolean =>
  lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;
