import { HexagonLayer } from "@deck.gl/aggregation-layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";

const COLOR_RAMP: [number, number, number][] = [
  [40, 90, 60],
  [120, 200, 110],
  [230, 220, 90],
  [255, 150, 60],
  [240, 70, 50],
  [200, 20, 20],
];

export const buildHeatmapLayer = (events: CotEvent[]): Layer =>
  new HexagonLayer<CotEvent>({
    id: "confidence-hex",
    data: events,
    pickable: false,
    extruded: false,
    radius: 180,
    coverage: 0.92,
    getPosition: (e) => [e.lon, e.lat],
    getColorWeight: (e) => 1 - e.confInt,
    colorAggregation: "MEAN",
    colorRange: COLOR_RAMP,
    upperPercentile: 98,
    opacity: 0.55,
    transitions: {
      getColorWeight: { duration: 2400, type: "interpolation" },
    },
  });
