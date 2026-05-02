import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";

const COLOR_RAMP: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [40, 130, 70, 60],
  [100, 200, 90, 110],
  [220, 220, 80, 160],
  [255, 150, 60, 200],
  [240, 70, 50, 220],
  [200, 20, 20, 230],
];

export const buildHeatmapLayer = (events: CotEvent[]): Layer =>
  new HeatmapLayer<CotEvent>({
    id: "confidence-heatmap",
    data: events,
    getPosition: (e) => [e.lon, e.lat],
    getWeight: (e) => 1 - e.confInt,
    radiusPixels: 90,
    intensity: 1.1,
    threshold: 0.04,
    colorRange: COLOR_RAMP,
    aggregation: "MEAN",
    opacity: 0.7,
  });
