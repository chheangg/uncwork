import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";

const COLOR_RAMP: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [40, 200, 90, 90],
  [110, 230, 110, 150],
  [220, 230, 80, 190],
  [255, 150, 60, 215],
  [240, 70, 50, 230],
  [200, 30, 30, 240],
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
    opacity: 0.75,
  });
