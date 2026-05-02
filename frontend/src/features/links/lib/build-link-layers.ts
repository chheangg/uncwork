import { IconLayer, LineLayer, TextLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent, Dimension, LinkStatus } from "@/types/cot";
import { sensorLabel } from "@/lib/sensor";
import type { AugmentedEvent } from "../hooks/use-affected-augment";
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

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const statusAlpha = (
  status: LinkStatus,
  confInt: number,
  uid: string,
  t: number,
): number => {
  const base = 0.45 + confInt * 0.55;
  const phase = t * 4 + (hash(uid) % 31);
  switch (status) {
    case "healthy":
      return base;
    case "degraded":
      return base * (0.55 + 0.45 * Math.sin(phase));
    case "critical":
      return base * (0.4 + 0.5 * Math.sin(phase * 1.4));
    case "stale":
      return base * 0.55;
    case "offline":
      return 0.3;
  }
};

export const buildLinkLayers = (
  events: AugmentedEvent[],
  currentTime: number,
): Layer[] => [
  new LineLayer<AugmentedEvent>({
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
  new IconLayer<AugmentedEvent>({
    id: "link-icon",
    data: events,
    pickable: true,
    sizeUnits: "pixels",
    getPosition: elevatedPosition,
    getIcon: (e) => iconFor(e),
    getSize: (e) => 38 + e.confInt * 18,
    getColor: (e) => [
      255,
      255,
      255,
      Math.round(255 * statusAlpha(e.status, e.confInt, e.uid, currentTime)),
    ],
    sizeMinPixels: 30,
    sizeMaxPixels: 68,
    billboard: true,
    parameters: { depthCompare: "always" },
    updateTriggers: {
      getIcon: events.map((e) => `${e.status}|${e.recentlyAffected}`).join(","),
      getColor: currentTime,
    },
    transitions: {
      getPosition: { duration: TRANSITION_MS, type: "interpolation" },
      getSize: { duration: TRANSITION_MS, type: "interpolation" },
    },
  }),
  new TextLayer<AugmentedEvent>({
    id: "link-label",
    data: events,
    pickable: false,
    getPosition: elevatedPosition,
    getText: (e) => {
      const id = e.callsign ?? sensorLabel(e.sensorType);
      return `${id}  ${Math.round(e.confInt * 100)}%`;
    },
    getSize: 13,
    getColor: [255, 245, 225, 245],
    getPixelOffset: [0, -42],
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    fontWeight: 700,
    background: true,
    backgroundPadding: [7, 3, 7, 3],
    getBackgroundColor: (e) => {
      const [r, g, b] = statusColor(e.status);
      return [r, g, b, 220];
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
