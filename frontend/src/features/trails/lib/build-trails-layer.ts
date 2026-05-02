import { PathLayer } from "@deck.gl/layers";
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

export const buildTrailsLayers = (
  paths: TrackPath[],
  currentTime: number,
): Layer[] => {
  const dashedHistoryProps = {
    id: "link-trail-history",
    data: paths,
    getPath: (d: TrackPath) => d.path,
    getColor: (d: TrackPath) => {
      const [r, g, b] = statusColor(d.status);
      return [r, g, b, 140];
    },
    widthUnits: "pixels" as const,
    getWidth: 2,
    widthMinPixels: 1.5,
    widthMaxPixels: 3,
    capRounded: true,
    jointRounded: true,
    extensions: [DASH_EXTENSION],
    getDashArray: [8, 5] as [number, number],
    dashJustified: false,
  };

  const fadingHead = new TripsLayer<TrackPath>({
    id: "link-trail-head",
    data: paths,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.timestamps,
    getColor: (d) => {
      const [r, g, b] = statusColor(d.status);
      return [r, g, b];
    },
    opacity: 0.95,
    widthUnits: "pixels",
    getWidth: 5,
    widthMinPixels: 3,
    widthMaxPixels: 7,
    rounded: true,
    capRounded: true,
    jointRounded: true,
    fadeTrail: true,
    trailLength: TRAIL_LENGTH_S,
    currentTime,
  });

  const dashedHistory = new PathLayer<TrackPath>(
    dashedHistoryProps as unknown as ConstructorParameters<
      typeof PathLayer<TrackPath>
    >[0],
  );

  return [dashedHistory, fadingHead];
};
