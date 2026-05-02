import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";

// Anchored on the link-status palette (link-style.ts) so the heatmap
// reads as the same semantic gradient as the per-track status badges:
// healthy green -> degraded yellow -> stale orange -> critical red.
const COLOR_RAMP: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [74, 222, 128, 110],
  [140, 235, 110, 170],
  [255, 209, 102, 205],
  [255, 140, 66, 225],
  [255, 58, 58, 240],
  [200, 20, 20, 245],
];

export const buildHeatmapLayer = (events: CotEvent[]): Layer =>
  new HeatmapLayer<CotEvent>({
    id: "confidence-heatmap",
    data: events,
    getPosition: (e) => [e.lon, e.lat],
    // Baseline weight per track so the heatmap reads as density even
    // when every track is high-confidence (e.g., live ADS-B). Extra
    // weight stacks for low-confidence/uncertain tracks.
    getWeight: (e) => 0.35 + (1 - e.confInt) * 0.65,
    radiusPixels: 90,
    intensity: 1.2,
    threshold: 0.04,
    colorRange: COLOR_RAMP,
    aggregation: "MEAN",
    opacity: 0.8,
  });
