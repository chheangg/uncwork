import { IconLayer, LineLayer, TextLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent, Dimension } from "@/types/cot";
import { sensorLabel } from "@/lib/sensor";
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
      return [r, g, b, Math.round(160 + e.confInt * 80)];
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
    getSize: (e) => 36 + e.confInt * 18,
    getColor: (e) => [
      255,
      255,
      255,
      Math.round(255 * (0.45 + e.confInt * 0.55)),
    ],
    sizeMinPixels: 28,
    sizeMaxPixels: 64,
    billboard: true,
    parameters: { depthCompare: "always" },
    transitions: {
      getPosition: { duration: TRANSITION_MS, type: "interpolation" },
      getSize: { duration: TRANSITION_MS, type: "interpolation" },
      getColor: { duration: TRANSITION_MS, type: "interpolation" },
    },
  }),
  new TextLayer<CotEvent>({
    id: "link-label",
    data: events,
    pickable: false,
    getPosition: elevatedPosition,
    getText: (e) =>
      `${sensorLabel(e.sensorType)}  ${Math.round(e.confInt * 100)}%`,
    getSize: 11,
    getColor: [255, 240, 220, 240],
    getPixelOffset: [0, -38],
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    fontWeight: 600,
    background: true,
    backgroundPadding: [5, 2, 5, 2],
    getBackgroundColor: (e) => {
      const [r, g, b] = statusColor(e.status);
      return [r, g, b, 210];
    },
    getBorderColor: [10, 5, 5, 255],
    getBorderWidth: 1,
    billboard: true,
    parameters: { depthCompare: "always" },
    outlineColor: [0, 0, 0, 255],
    outlineWidth: 2,
    characterSet: "auto",
    transitions: {
      getPosition: { duration: TRANSITION_MS, type: "interpolation" },
      getBackgroundColor: { duration: TRANSITION_MS, type: "interpolation" },
    },
  }),
];
