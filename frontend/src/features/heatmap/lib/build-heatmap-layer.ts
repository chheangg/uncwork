import { ScatterplotLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import { statusColor } from "@/features/links/lib/link-style";

// One status-colored disc per track. RGBA is the exact value
// returned by statusColor() at alpha 220 -- the same RGBA the link
// label badge is rendered at -- so the disc under a track and its
// percentage badge are identical pixels (no gradient, no alpha
// drift, no auto-normalization).
const ALPHA = 220;

export const buildHeatmapLayer = (events: CotEvent[]): Layer =>
  new ScatterplotLayer<CotEvent>({
    id: "confidence-heatmap",
    data: events,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: "pixels",
    getPosition: (e) => [e.lon, e.lat, 0],
    getRadius: 90,
    getFillColor: (e) => {
      if (e.status === "offline") return [0, 0, 0, 0];
      const [r, g, b] = statusColor(e.status);
      return [r, g, b, ALPHA];
    },
    updateTriggers: {
      getFillColor: events.map((e) => e.status).join(","),
    },
    parameters: { depthCompare: "always" },
  });
