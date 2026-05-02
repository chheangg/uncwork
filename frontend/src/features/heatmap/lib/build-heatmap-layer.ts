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
    getWeight: (e) => 1 - e.confInt,
    radiusPixels: 90,
    intensity: 1.2,
    threshold: 0.04,
    colorRange: COLOR_RAMP,
    aggregation: "MEAN",
    opacity: 0.75,
  });
