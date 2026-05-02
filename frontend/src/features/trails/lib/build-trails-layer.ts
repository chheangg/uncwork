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

type DashProps = {
  getDashArray: [number, number];
  dashJustified: boolean;
};

export const buildTrailsLayer = (
  paths: TrackPath[],
  currentTime: number,
): Layer => {
  const dashProps: DashProps = {
    getDashArray: [4, 3],
    dashJustified: true,
  };
  return new TripsLayer<TrackPath>({
    id: "link-trails",
    data: paths,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.timestamps,
    getColor: (d) => {
      const [r, g, b] = statusColor(d.status);
      return [r, g, b];
    },
    opacity: 0.95,
    widthMinPixels: 5,
    widthMaxPixels: 9,
    rounded: true,
    fadeTrail: true,
    trailLength: TRAIL_LENGTH_S,
    currentTime,
    capRounded: true,
    jointRounded: true,
    extensions: [DASH_EXTENSION],
    ...(dashProps as unknown as Record<string, never>),
  });
};
