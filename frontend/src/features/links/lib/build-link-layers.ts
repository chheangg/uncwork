import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import {
  affiliationFill,
  radiusFromConfidence,
  statusColor,
  type RGBA,
} from "./link-style";

const AFFILIATION_GLYPH: Record<string, string> = {
  friendly: "F",
  hostile: "H",
  neutral: "N",
  unknown: "?",
  pending: "P",
  assumed: "A",
  suspect: "S",
};

const FG: RGBA = [10, 16, 20, 255];

export const buildLinkLayers = (events: CotEvent[]): Layer[] => [
  new ScatterplotLayer<CotEvent>({
    id: "link-halo",
    data: events,
    pickable: false,
    radiusUnits: "meters",
    stroked: false,
    getPosition: (e) => [e.lon, e.lat],
    getRadius: (e) => radiusFromConfidence(e.confInt) * 1.6,
    getFillColor: (e) => {
      const [r, g, b] = statusColor(e.status);
      return [r, g, b, 40];
    },
  }),
  new ScatterplotLayer<CotEvent>({
    id: "link-marker",
    data: events,
    pickable: true,
    radiusUnits: "meters",
    stroked: true,
    lineWidthUnits: "pixels",
    getPosition: (e) => [e.lon, e.lat],
    getRadius: (e) => radiusFromConfidence(e.confInt),
    getFillColor: (e) => affiliationFill(e.affiliation),
    getLineColor: (e) => statusColor(e.status),
    getLineWidth: 2,
  }),
  new TextLayer<CotEvent>({
    id: "link-glyph",
    data: events,
    pickable: false,
    sizeUnits: "pixels",
    getPosition: (e) => [e.lon, e.lat],
    getText: (e) => AFFILIATION_GLYPH[e.affiliation] ?? "?",
    getSize: 11,
    getColor: FG,
    fontFamily: "JetBrains Mono, monospace",
    fontWeight: 700,
    background: false,
  }),
];
