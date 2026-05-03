import { IconLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import {
  heatmapBaseAlpha,
  statusColor,
} from "@/features/links/lib/link-style";
import { useLayersStore } from "@/stores/layers";

// Soft-edged disc sprite: a single radial-gradient SVG used by every
// track. mask: true tells IconLayer to treat the sprite's alpha as a
// stencil and use getColor for the actual RGB -- so the gradient
// falloff happens once at sprite bake time, and each track tints it
// with its status color at render time. Combined with additive
// blending, overlapping discs fizz out into a soft glow instead of
// stacking as hard circles.
const SPRITE_PX = 128;
// Tight falloff: core stays solid through the inner half so the
// disc reads as a real halo, with the outer ring providing the
// "soft edge" without bleeding all the way to nothing across most
// of the radius.
const SOFT_DISC_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SPRITE_PX}" height="${SPRITE_PX}" viewBox="0 0 ${SPRITE_PX} ${SPRITE_PX}">` +
  `<defs><radialGradient id="g" cx="${SPRITE_PX / 2}" cy="${SPRITE_PX / 2}" r="${SPRITE_PX / 2}" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="#fff" stop-opacity="1"/>` +
  `<stop offset="0.5" stop-color="#fff" stop-opacity="0.92"/>` +
  `<stop offset="0.8" stop-color="#fff" stop-opacity="0.42"/>` +
  `<stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
  `</radialGradient></defs>` +
  `<circle cx="${SPRITE_PX / 2}" cy="${SPRITE_PX / 2}" r="${SPRITE_PX / 2}" fill="url(#g)"/>` +
  `</svg>`;

const SOFT_DISC = {
  url: `data:image/svg+xml;utf8,${encodeURIComponent(SOFT_DISC_SVG)}`,
  width: SPRITE_PX,
  height: SPRITE_PX,
  mask: true as const,
};

// Per-disc alpha is sourced from heatmapBaseAlpha() which returns a
// per-basemap value (topo gets more punch, satellite stays soft).
// Slightly smaller min/max than before so each track reads as a
// distinct halo rather than a soft spread that disappears into the
// terrain.
const SIZE_MIN_PX = 70;
const SIZE_MAX_PX = 220;

const sizeFor = (e: CotEvent): number =>
  SIZE_MIN_PX + (1 - e.confInt) * (SIZE_MAX_PX - SIZE_MIN_PX);

export const buildHeatmapLayers = (events: CotEvent[]): Layer[] => {
  const visible = events.filter((e) => e.status !== "offline");
  const mapStyle = useLayersStore.getState().mapStyle;
  const alpha = heatmapBaseAlpha();
  return [
    new IconLayer<CotEvent>({
      id: "confidence-heatmap",
      data: visible,
      pickable: false,
      sizeUnits: "pixels",
      // Lay the disc flat on the ground plane so it tilts with the
      // map pitch and bearing instead of always facing the camera.
      // sizeUnits stays "pixels" so screen size is stable regardless
      // of zoom -- the disc looks like a glow painted on the
      // terrain that pivots as the camera moves.
      billboard: false,
      getIcon: () => SOFT_DISC,
      getPosition: (e) => [e.lon, e.lat, 0],
      getSize: sizeFor,
      getColor: (e) => {
        const [r, g, b] = statusColor(e.status);
        return [r, g, b, alpha];
      },
      updateTriggers: {
        getSize: visible.map((e) => e.confInt.toFixed(2)).join(","),
        getColor: `${mapStyle}|${visible.map((e) => e.status).join(",")}`,
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
