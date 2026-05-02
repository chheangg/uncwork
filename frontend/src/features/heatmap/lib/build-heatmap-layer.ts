import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import { statusColor } from "@/features/links/lib/link-style";

// Use the exact same RGBs as the per-link status palette so a green
// hot-spot on the heatmap reads as "healthy" and a red one reads as
// "critical" -- no chromatic drift between widgets.
const [hr, hg, hb] = statusColor("healthy");
const [yr, yg, yb] = statusColor("degraded");
const [or_, og, ob] = statusColor("stale");
const [cr, cg, cb] = statusColor("critical");

const COLOR_RAMP: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [hr, hg, hb, 130],
  [yr, yg, yb, 200],
  [or_, og, ob, 225],
  [cr, cg, cb, 245],
];

export const buildHeatmapLayer = (events: CotEvent[]): Layer =>
  new HeatmapLayer<CotEvent>({
    id: "confidence-heatmap",
    data: events,
    getPosition: (e) => [e.lon, e.lat],
    // Weight encodes uncertainty (1 - confInt) with a small density
    // baseline so high-confidence tracks still register as faint heat.
    getWeight: (e) => 0.15 + (1 - e.confInt) * 0.85,
    // Anchor the gradient to absolute weight. With colorDomain [0.1,1]
    // and 5 stops, weight 0.32 -> healthy / 0.55 -> degraded / 0.78 ->
    // stale / 1.0 -> critical. Same thresholds the status badges use.
    colorDomain: [0.1, 1],
    aggregation: "MEAN",
    colorRange: COLOR_RAMP,
    radiusPixels: 90,
    intensity: 1.1,
    threshold: 0.04,
    opacity: 0.8,
  });
