import { PathLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import type { Layer } from "@deck.gl/core";
import { statusColor } from "@/features/links/lib/link-style";
import type { TrackPath } from "@/lib/track-path";

export const TRAIL_FADE_S = 60;

const DASH_EXTENSION = new PathStyleExtension({
  dash: true,
  highPrecisionDash: true,
});

const fadeFactor = (age: number): number =>
  Math.max(0, Math.min(1, 1 - age / TRAIL_FADE_S));

const perVertexColor = (
  d: TrackPath,
  baseAlpha: number,
  now: number,
): [number, number, number, number][] => {
  const sameLengths = d.statuses.length === d.path.length;
  return d.path.map((_, i) => {
    const status = sameLengths ? d.statuses[i]! : d.latest.status;
    const [r, g, b] = statusColor(status);
    const ts = d.timestamps[i] ?? now;
    const alpha = Math.round(baseAlpha * fadeFactor(now - ts));
    return [r, g, b, alpha];
  });
};

const lastSegment = (d: TrackPath): [number, number][] => {
  const n = d.path.length;
  if (n < 2) return [];
  return [d.path[n - 2]!, d.path[n - 1]!];
};

const headColor = (
  d: TrackPath,
  now: number,
): [number, number, number, number] => {
  const [r, g, b] = statusColor(d.latest.status);
  const lastTs = d.timestamps[d.timestamps.length - 1] ?? now;
  const alpha = Math.round(255 * fadeFactor(now - lastTs));
  return [r, g, b, alpha];
};

// Quantize the fade clock to 500ms steps so deck.gl only re-uploads
// the (potentially large) per-vertex color buffer ~2x/sec instead of
// once per animation frame. Over a 60s fade window the quantization
// is invisible (<1% alpha step), and the GPU work drops ~15x.
const FADE_QUANT_S = 0.5;

export const buildTrailsLayers = (
  paths: TrackPath[],
  now: number,
): Layer[] => {
  const fadeNow = Math.floor(now / FADE_QUANT_S) * FADE_QUANT_S;
  const dashedHistoryProps = {
    id: "link-trail-history",
    data: paths,
    getPath: (d: TrackPath) => d.path,
    getColor: (d: TrackPath) => perVertexColor(d, 140, fadeNow),
    widthUnits: "pixels" as const,
    getWidth: 2,
    widthMinPixels: 1.5,
    widthMaxPixels: 3,
    capRounded: true,
    jointRounded: true,
    extensions: [DASH_EXTENSION],
    getDashArray: [8, 5] as [number, number],
    dashJustified: false,
    updateTriggers: {
      getColor: fadeNow,
    },
  };

  const solidHeadProps = {
    id: "link-trail-head",
    data: paths,
    getPath: lastSegment,
    getColor: (d: TrackPath) => headColor(d, fadeNow),
    widthUnits: "pixels" as const,
    getWidth: 5,
    widthMinPixels: 3,
    widthMaxPixels: 7,
    capRounded: true,
    jointRounded: true,
    updateTriggers: {
      getColor: fadeNow,
    },
  };

  const dashedHistory = new PathLayer<TrackPath>(
    dashedHistoryProps as unknown as ConstructorParameters<
      typeof PathLayer<TrackPath>
    >[0],
  );

  const solidHead = new PathLayer<TrackPath>(solidHeadProps);

  return [dashedHistory, solidHead];
};
