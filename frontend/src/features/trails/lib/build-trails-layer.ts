import { TripsLayer } from "@deck.gl/geo-layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { Layer } from "@deck.gl/core";
import { statusColor } from "@/features/links/lib/link-style";
import type { TrackPath } from "../hooks/use-track-history";

export const TRAIL_LENGTH_S = 30;

const DASH_EXTENSION = new PathStyleExtension({
  dash: true,
  highPrecisionDash: true,
});

export const buildTrailsLayer = (
  paths: TrackPath[],
  currentTime: number,
): Layer => {
  const props = {
    id: "link-trails",
    data: paths,
    getPath: (d: TrackPath) => d.path,
    getTimestamps: (d: TrackPath) => d.timestamps,
    getColor: (d: TrackPath) => {
      const [r, g, b] = statusColor(d.status);
      return [r, g, b];
    },
    opacity: 0.95,
    widthUnits: "pixels" as const,
    getWidth: 4,
    widthMinPixels: 3,
    widthMaxPixels: 7,
    rounded: true,
    fadeTrail: true,
    trailLength: TRAIL_LENGTH_S,
    currentTime,
    capRounded: true,
    jointRounded: true,
    extensions: [DASH_EXTENSION],
    getDashArray: [10, 6] as [number, number],
    dashJustified: false,
  };
  return new TripsLayer<TrackPath>(
    props as unknown as ConstructorParameters<typeof TripsLayer<TrackPath>>[0],
  );
};
