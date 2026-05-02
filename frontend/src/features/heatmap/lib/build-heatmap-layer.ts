import { ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import { statusColor } from "@/features/links/lib/link-style";

// One translucent disc per track, status-colored, sized by
// (1 - confInt). Rendered with additive blending so overlapping
// discs sum their RGB and brighten where density accumulates --
// gives a heatmap merge feel without the GPU aggregation cost of
// HeatmapLayer (kernel rasterize + multi-pass smoothing per layer
// per data change). Cost here is "draw N antialiased circles": the
// same as the IconLayer.
const ALPHA = 70;
const RADIUS_MIN_PX = 24;
const RADIUS_MAX_PX = 110;

const radiusFor = (e: CotEvent): number =>
  RADIUS_MIN_PX + (1 - e.confInt) * (RADIUS_MAX_PX - RADIUS_MIN_PX);

export const buildHeatmapLayers = (events: CotEvent[]): Layer[] => {
  const visible = events.filter((e) => e.status !== "offline");
  return [
    new ScatterplotLayer<CotEvent>({
      id: "confidence-heatmap",
      data: visible,
      pickable: false,
      stroked: false,
      filled: true,
      antialiasing: true,
      radiusUnits: "pixels",
      getPosition: (e) => [e.lon, e.lat, 0],
      getRadius: radiusFor,
      getFillColor: (e) => {
        const [r, g, b] = statusColor(e.status);
        return [r, g, b, ALPHA];
      },
      updateTriggers: {
        getRadius: visible.map((e) => e.confInt.toFixed(2)).join(","),
        getFillColor: visible.map((e) => e.status).join(","),
      },
      parameters: {
        depthCompare: "always",
        blend: true,
        blendColorOperation: "add",
        blendAlphaOperation: "add",
        blendColorSrcFactor: "src-alpha",
        blendColorDstFactor: "one",
        blendAlphaSrcFactor: "one",
        blendAlphaDstFactor: "one",
      },
    }),
  ];
};
