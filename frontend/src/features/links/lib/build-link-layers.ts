import { IconLayer, LineLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent, Dimension } from "@/types/cot";
import { statusColor } from "./link-style";
import { iconFor } from "./icons";

const TRANSITION_MS = 2400;

const ALTITUDE: Record<Dimension, number> = {
  air: 220,
  space: 360,
  sof: 60,
  ground: 25,
  sea_surface: 10,
  sea_subsurface: 5,
  other: 25,
};

const elevatedPosition = (e: CotEvent): [number, number, number] => [
  e.lon,
  e.lat,
  ALTITUDE[e.dimension],
];

const groundPosition = (e: CotEvent): [number, number, number] => [
  e.lon,
  e.lat,
  0,
];

export const buildLinkLayers = (events: CotEvent[]): Layer[] => [
  new LineLayer<CotEvent>({
    id: "link-pole",
    data: events,
    pickable: false,
    widthUnits: "pixels",
    getSourcePosition: groundPosition,
    getTargetPosition: elevatedPosition,
    getColor: (e) => {
      const [r, g, b] = statusColor(e.status);
      return [r, g, b, 200];
    },
    getWidth: 1.5,
    transitions: {
      getSourcePosition: { duration: TRANSITION_MS, type: "interpolation" },
      getTargetPosition: { duration: TRANSITION_MS, type: "interpolation" },
    },
  }),
  new IconLayer<CotEvent>({
    id: "link-icon",
    data: events,
    pickable: true,
    sizeUnits: "pixels",
    getPosition: elevatedPosition,
    getIcon: (e) => iconFor(e),
    getSize: (e) => 40 + (1 - e.confInt) * 14,
    sizeMinPixels: 32,
    sizeMaxPixels: 64,
    billboard: true,
    parameters: { depthCompare: "always" },
    transitions: {
      getPosition: { duration: TRANSITION_MS, type: "interpolation" },
      getSize: { duration: TRANSITION_MS, type: "interpolation" },
    },
  }),
];
