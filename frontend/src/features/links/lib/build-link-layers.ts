import { IconLayer, LineLayer, TextLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { Dimension, LinkStatus } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";
import { positionAt } from "@/lib/track-path";
import { sensorLabel } from "@/lib/sensor";
import { useLayersStore } from "@/stores/layers";
import type { AugmentedEvent } from "../hooks/use-affected-augment";
import { statusColor } from "./link-style";
import { iconFor } from "./icons";

type Track = TrackPath<AugmentedEvent>;

const ALTITUDE: Record<Dimension, number> = {
  air: 220,
  space: 360,
  sof: 60,
  ground: 25,
  sea_surface: 10,
  sea_subsurface: 5,
  sensor: 8,
  other: 25,
};

const elevatedAt = (p: Track, t: number): [number, number, number] => {
  const [lon, lat] = positionAt(p.path, p.timestamps, t);
  return [lon, lat, ALTITUDE[p.latest.dimension]];
};

const groundAt = (p: Track, t: number): [number, number, number] => {
  const [lon, lat] = positionAt(p.path, p.timestamps, t);
  return [lon, lat, 0];
};

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const statusAlpha = (
  status: LinkStatus,
  trustScore: number,
  uid: string,
  animTime: number,
  stale: boolean,
): number => {
  const base = 0.45 + trustScore * 0.55;
  const phase = animTime * 4 + (hash(uid) % 31);
  let alpha: number;
  switch (status) {
    case "healthy":
      alpha = base;
      break;
    case "degraded":
      alpha = base * (0.55 + 0.45 * Math.sin(phase));
      break;
    case "critical":
      alpha = base * (0.4 + 0.5 * Math.sin(phase * 1.4));
      break;
    case "offline":
      alpha = 0.3;
      break;
  }
  return stale ? alpha * 0.85 : alpha;
};

export const buildLinkLayers = (
  paths: Track[],
  renderTime: number,
  animTime: number,
): Layer[] => {
  const mapStyle = useLayersStore.getState().mapStyle;
  const statusKeyForTrigger = paths.map((p) => p.latest.status).join(",");
  return [
  new LineLayer<Track>({
    id: "link-pole",
    data: paths,
    pickable: false,
    widthUnits: "pixels",
    getSourcePosition: (p) => groundAt(p, renderTime),
    getTargetPosition: (p) => elevatedAt(p, renderTime),
    getColor: (p) => {
      const [r, g, b] = statusColor(p.latest.status);
      return [r, g, b, Math.round(160 + p.latest.trustScore * 80)];
    },
    getWidth: 1.5,
    updateTriggers: {
      getSourcePosition: renderTime,
      getTargetPosition: renderTime,
      getColor: `${mapStyle}|${statusKeyForTrigger}`,
    },
  }),
  new IconLayer<Track>({
    id: "link-icon",
    data: paths,
    pickable: true,
    sizeUnits: "pixels",
    getPosition: (p) => elevatedAt(p, renderTime),
    getIcon: (p) => iconFor(p.latest),
    getSize: (p) => 38 + p.latest.trustScore * 18,
    getColor: (p) => [
      255,
      255,
      255,
      Math.round(
        255 *
          statusAlpha(
            p.latest.status,
            p.latest.trustScore,
            p.uid,
            animTime,
            p.latest.stale,
          ),
      ),
    ],
    sizeMinPixels: 30,
    sizeMaxPixels: 68,
    billboard: true,
    parameters: { depthCompare: "always" },
    updateTriggers: {
      getPosition: renderTime,
      getIcon: paths
        .map(
          (p) =>
            `${p.latest.status}|${p.latest.recentlyAffected}|${p.latest.stale ? 1 : 0}`,
        )
        .join(","),
      getColor: animTime,
    },
  }),
  new TextLayer<Track>({
    id: "link-label",
    data: paths,
    pickable: false,
    getPosition: (p) => elevatedAt(p, renderTime),
    getText: (p) => {
      const id = p.latest.callsign ?? sensorLabel(p.latest.sensorType);
      return `${id}  ${Math.round(p.latest.trustScore * 100)}%`;
    },
    getSize: 13,
    getColor: [255, 245, 225, 245],
    getPixelOffset: [0, -42],
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    fontWeight: 700,
    background: true,
    backgroundPadding: [7, 3, 7, 3],
    getBackgroundColor: (p) => {
      const [r, g, b] = statusColor(p.latest.status);
      return [r, g, b, 220];
    },
    getBorderColor: [10, 5, 5, 255],
    getBorderWidth: 1,
    billboard: true,
    parameters: { depthCompare: "always" },
    outlineColor: [0, 0, 0, 255],
    outlineWidth: 2,
    characterSet: "auto",
    updateTriggers: {
      getPosition: renderTime,
      getBackgroundColor: `${mapStyle}|${statusKeyForTrigger}`,
    },
  }),
  ];
};
