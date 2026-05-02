import { TripsLayer } from "@deck.gl/geo-layers";
import type { Layer } from "@deck.gl/core";
import { statusColor } from "@/features/links/lib/link-style";
import type { TrackPath } from "../hooks/use-track-history";

export const TRAIL_LENGTH_S = 5;

export const buildTrailsLayer = (
  paths: TrackPath[],
  currentTime: number,
): Layer =>
  new TripsLayer<TrackPath>({
    id: "link-trails",
    data: paths,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.timestamps,
    getColor: (d) => {
      const [r, g, b] = statusColor(d.status);
      return [r, g, b];
    },
    opacity: 0.85,
    widthMinPixels: 2.5,
    rounded: true,
    fadeTrail: true,
    trailLength: TRAIL_LENGTH_S,
    currentTime,
  });
