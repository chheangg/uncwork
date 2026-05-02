import { PathLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { Layer } from "@deck.gl/core";
import { statusColor } from "@/features/links/lib/link-style";
import type { TrackPath } from "@/lib/track-path";

export const TRAIL_LENGTH_S = 30;

const DASH_EXTENSION = new PathStyleExtension({
  dash: true,
  highPrecisionDash: true,
});

// One color per vertex so trail segments keep the status they had
// at the time the segment was recorded, not the track's current
// status. (Path/TripsLayer interpolates colors between vertices.)
const perVertexColor = (
  d: TrackPath,
  alpha: number,
): [number, number, number, number][] => {
  if (d.statuses.length !== d.path.length) {
    const [r, g, b] = statusColor(d.latest.status);
    return d.path.map(() => [r, g, b, alpha]);
  }
  return d.statuses.map((s) => {
    const [r, g, b] = statusColor(s);
    return [r, g, b, alpha];
  });
};

export const buildTrailsLayers = (
  paths: TrackPath[],
  renderTime: number,
): Layer[] => {
  const dashedHistoryProps = {
    id: "link-trail-history",
    data: paths,
    getPath: (d: TrackPath) => d.path,
    getColor: (d: TrackPath) => perVertexColor(d, 140),
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

  const fadingHead = new TripsLayer<TrackPath>(
    {
      id: "link-trail-head",
      data: paths,
      getPath: (d: TrackPath) => d.path,
      getTimestamps: (d: TrackPath) => d.timestamps,
      getColor: ((d: TrackPath) => perVertexColor(d, 255)) as never,
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
      currentTime: renderTime,
    } as unknown as ConstructorParameters<typeof TripsLayer<TrackPath>>[0],
  );

  const dashedHistory = new PathLayer<TrackPath>(
    dashedHistoryProps as unknown as ConstructorParameters<
      typeof PathLayer<TrackPath>
    >[0],
  );

  return [dashedHistory, fadingHead];
};
