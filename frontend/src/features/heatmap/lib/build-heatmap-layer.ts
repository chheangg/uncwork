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
    // Weight encodes uncertainty (1 - confInt) with a small density
    // baseline so high-confidence tracks still register as faint heat.
    getWeight: (e) => 0.15 + (1 - e.confInt) * 0.85,
    // Anchor the gradient to absolute weight. Without this, deck.gl
    // auto-normalizes the visible max to the top of the ramp, so a
    // single high-confidence track would render as the critical-red
    // top stop instead of the healthy-green low stop.
    colorDomain: [0.1, 1],
    aggregation: "MEAN",
    colorRange: COLOR_RAMP,
    radiusPixels: 90,
    intensity: 1.1,
    threshold: 0.04,
    opacity: 0.8,
  });
