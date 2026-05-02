import { HexagonLayer } from "@deck.gl/aggregation-layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";

const COLOR_RAMP: [number, number, number][] = [
  [40, 90, 60],
  [90, 200, 120],
  [220, 230, 110],
  [255, 170, 70],
  [240, 90, 70],
  [200, 30, 30],
];

export const buildHeatmapLayer = (events: CotEvent[]): Layer =>
  new HexagonLayer<CotEvent>({
    id: "confidence-hex",
    data: events,
    pickable: false,
    extruded: true,
    radius: 220,
    elevationScale: 6,
    elevationRange: [0, 240],
    coverage: 0.92,
    upperPercentile: 98,
    getPosition: (e) => [e.lon, e.lat],
    getElevationWeight: (e) => 1 - e.confInt,
    getColorWeight: (e) => 1 - e.confInt,
    elevationAggregation: "MEAN",
    colorAggregation: "MEAN",
    colorRange: COLOR_RAMP,
    opacity: 0.45,
    material: {
      ambient: 0.55,
      diffuse: 0.6,
      shininess: 24,
      specularColor: [50, 70, 50],
    },
  });
