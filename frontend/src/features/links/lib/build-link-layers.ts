import { IconLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import { radiusFromConfidence, statusColor } from "./link-style";
import { iconFor } from "./icons";

const TRANSITION_MS = 2400;

export const buildLinkLayers = (events: CotEvent[]): Layer[] => [
  new ScatterplotLayer<CotEvent>({
    id: "link-halo",
    data: events,
    pickable: false,
    radiusUnits: "meters",
    stroked: false,
    getPosition: (e) => [e.lon, e.lat],
    getRadius: (e) => radiusFromConfidence(e.confInt) * 1.4,
    getFillColor: (e) => {
      const [r, g, b] = statusColor(e.status);
      return [r, g, b, 60];
    },
    transitions: {
      getPosition: { duration: TRANSITION_MS, type: "interpolation" },
      getRadius: { duration: TRANSITION_MS, type: "interpolation" },
      getFillColor: { duration: TRANSITION_MS, type: "interpolation" },
    },
  }),
  new IconLayer<CotEvent>({
    id: "link-icon",
    data: events,
    pickable: true,
    sizeUnits: "pixels",
    getPosition: (e) => [e.lon, e.lat],
    getIcon: (e) => iconFor(e),
    getSize: (e) => 24 + (1 - e.confInt) * 8,
    sizeMinPixels: 18,
    sizeMaxPixels: 40,
    billboard: true,
    parameters: {
      depthCompare: "always",
    },
    transitions: {
      getPosition: { duration: TRANSITION_MS, type: "interpolation" },
      getSize: { duration: TRANSITION_MS, type: "interpolation" },
    },
  }),
];
