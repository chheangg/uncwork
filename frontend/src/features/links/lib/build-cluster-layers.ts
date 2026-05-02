import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import { statusColor } from "./link-style";
import type { Cluster } from "./cluster";

const ALT_M = 50;

const radiusOf = (count: number): number =>
  18 + Math.log2(Math.max(2, count)) * 5;

const fontOf = (count: number): number =>
  13 + Math.log2(Math.max(2, count)) * 1.5;

export const buildClusterLayers = (clusters: Cluster[]): Layer[] => [
  new ScatterplotLayer<Cluster>({
    id: "link-cluster-circle",
    data: clusters,
    pickable: true,
    radiusUnits: "pixels",
    stroked: true,
    filled: true,
    lineWidthUnits: "pixels",
    getPosition: (c) => [c.lon, c.lat, ALT_M],
    getRadius: (c) => radiusOf(c.count),
    getFillColor: (c) => {
      const [r, g, b] = statusColor(c.status);
      return [r, g, b, 220];
    },
    getLineColor: [10, 10, 10, 255],
    getLineWidth: 2,
    parameters: { depthCompare: "always" },
  }),
  new TextLayer<Cluster>({
    id: "link-cluster-count",
    data: clusters,
    pickable: false,
    getPosition: (c) => [c.lon, c.lat, ALT_M],
    getText: (c) => String(c.count),
    getSize: (c) => fontOf(c.count),
    getColor: [10, 5, 5, 255],
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    fontWeight: 800,
    background: false,
    billboard: true,
    parameters: { depthCompare: "always" },
  }),
];
