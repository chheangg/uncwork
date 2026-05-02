import { IconLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent } from "@/types/cot";
import { statusColor } from "@/features/links/lib/link-style";

// Soft-edged disc sprite: a single radial-gradient SVG used by every
// track. mask: true tells IconLayer to treat the sprite's alpha as a
// stencil and use getColor for the actual RGB -- so the gradient
// falloff happens once at sprite bake time, and each track tints it
// with its status color at render time. Combined with additive
// blending, overlapping discs fizz out into a soft glow instead of
// stacking as hard circles.
const SPRITE_PX = 128;
const SOFT_DISC_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SPRITE_PX}" height="${SPRITE_PX}" viewBox="0 0 ${SPRITE_PX} ${SPRITE_PX}">` +
  `<defs><radialGradient id="g" cx="${SPRITE_PX / 2}" cy="${SPRITE_PX / 2}" r="${SPRITE_PX / 2}" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="#fff" stop-opacity="1"/>` +
  `<stop offset="0.35" stop-color="#fff" stop-opacity="0.65"/>` +
  `<stop offset="0.7" stop-color="#fff" stop-opacity="0.22"/>` +
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

const ALPHA = 180;
const SIZE_MIN_PX = 80;
const SIZE_MAX_PX = 280;

const sizeFor = (e: CotEvent): number =>
  SIZE_MIN_PX + (1 - e.confInt) * (SIZE_MAX_PX - SIZE_MIN_PX);

export const buildHeatmapLayers = (events: CotEvent[]): Layer[] => {
  const visible = events.filter((e) => e.status !== "offline");
  return [
    new IconLayer<CotEvent>({
      id: "confidence-heatmap",
      data: visible,
      pickable: false,
      sizeUnits: "pixels",
      billboard: true,
      getIcon: () => SOFT_DISC,
      getPosition: (e) => [e.lon, e.lat, 0],
      getSize: sizeFor,
      getColor: (e) => {
        const [r, g, b] = statusColor(e.status);
        return [r, g, b, ALPHA];
      },
      updateTriggers: {
        getSize: visible.map((e) => e.confInt.toFixed(2)).join(","),
        getColor: visible.map((e) => e.status).join(","),
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
