import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import { statusColor } from "@/features/links/lib/link-style";

// Use the exact same RGBs and alpha as the status badge background
// (link-style.ts statusColor() at the alpha set in build-link-layers
// label background = 220) so a green hot-spot on the heatmap and the
// healthy status badge are pixel-identical fills.
const ALPHA = 220;
const [hr, hg, hb] = statusColor("healthy");
const [yr, yg, yb] = statusColor("degraded");
const [or_, og, ob] = statusColor("stale");
const [cr, cg, cb] = statusColor("critical");

// Hard-stepped gradient: the alpha-0 stop has the healthy RGB so
// edge pixels fade in green (not toward black). Each color band is
// followed by a near-duplicate stop so the transition between
// status zones is sharp -- weight 0.30 reads as healthy, 0.55 as
// degraded, etc., with minimal in-between gradient mush.
const COLOR_RAMP: [number, number, number, number][] = [
  [hr, hg, hb, 0],
  [hr, hg, hb, ALPHA],
  [hr, hg, hb, ALPHA],
  [yr, yg, yb, ALPHA],
  [yr, yg, yb, ALPHA],
  [or_, og, ob, ALPHA],
  [or_, og, ob, ALPHA],
  [cr, cg, cb, ALPHA],
];

export const buildHeatmapLayer = (events: CotEvent[]): Layer =>
  new HeatmapLayer<CotEvent>({
    id: "confidence-heatmap",
    data: events,
    getPosition: (e) => [e.lon, e.lat],
    getWeight: (e) => 0.15 + (1 - e.confInt) * 0.85,
    colorDomain: [0.1, 1],
    aggregation: "MEAN",
    colorRange: COLOR_RAMP,
    radiusPixels: 90,
    intensity: 1.1,
    threshold: 0.04,
    opacity: 1,
  });
