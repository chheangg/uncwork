import { IconLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { Attribution } from "./attribution";
import { fingerprintTone } from "./fingerprint-tone";

const ICON_W = 88;
const ICON_H = 32;

/**
 * Build a per-unit attribution badge as a baked SVG icon. The badge is
 * a small red shield-tag with the catalog tag name and confidence
 * percent. Color is the three-step red gradient from `fingerprintTone`.
 *
 * The SVG is built fresh per attribution because the text inside it
 * varies — milsymbol-style caching by `(tag, confidence-bucket)` would
 * help if this got hot, but with ~3 ground units it's not a concern.
 */
const buildBadgeIcon = (attribution: Attribution) => {
  const tone = fingerprintTone(attribution.fingerprint.confidence);
  const pct = Math.round(attribution.fingerprint.confidence * 100);
  const tagText = attribution.fingerprint.tag.toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_W} ${ICON_H}" width="${ICON_W}" height="${ICON_H}">
      <defs>
        <filter id="g" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2"/>
        </filter>
      </defs>
      <rect x="1" y="1" width="${ICON_W - 2}" height="${ICON_H - 2}"
            fill="rgba(8,12,18,0.85)" stroke="${tone.hex}" stroke-width="1.5"/>
      <polygon points="${ICON_W - 1},${ICON_H / 2} ${ICON_W + 6},${ICON_H / 2 - 5} ${ICON_W + 6},${ICON_H / 2 + 5}"
               fill="${tone.hex}"/>
      <text x="6" y="13" font-family="JetBrains Mono, ui-monospace, monospace"
            font-size="10" font-weight="700" fill="${tone.hex}">${tagText}</text>
      <text x="6" y="26" font-family="JetBrains Mono, ui-monospace, monospace"
            font-size="9" font-weight="700" fill="#d0f0ff">${pct}% ${tone.label}</text>
    </svg>
  `.trim();
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  return { url, width: ICON_W, height: ICON_H, anchorX: ICON_W, anchorY: ICON_H / 2 };
};

/**
 * Per-unit fingerprint attribution badge layer. Renders a small tag to
 * the *left* of the ground asset, leaving the icon's top-right and
 * bottom-right slots free for the existing status and stale badges
 * (per `frontend/CLAUDE.md` visual contract).
 *
 * High-confidence attributions pulse via the `animTime` argument; low
 * and medium fade gracefully but stay solid.
 */
export const buildAttributionLayer = (
  attributions: Attribution[],
  animTime: number,
): Layer[] => {
  if (attributions.length === 0) return [];
  return [
    new IconLayer<Attribution>({
      id: "attribution-badge",
      data: attributions,
      pickable: false,
      sizeUnits: "pixels",
      getPosition: (a) => [a.sensorLon, a.sensorLat, 30],
      getIcon: (a) => buildBadgeIcon(a),
      getSize: ICON_H,
      sizeMinPixels: ICON_H,
      sizeMaxPixels: ICON_H * 1.3,
      // Slot the badge to the left of the ground icon. Pixel offset is
      // negative-x so it sits beside the NATO symbol without colliding
      // with the top-right status badge or bottom-right stale badge.
      getPixelOffset: [-46, 0],
      getColor: (a) => {
        const conf = a.fingerprint.confidence;
        const tone = fingerprintTone(conf);
        if (!tone.pulse) return [255, 255, 255, 240];
        // Slow pulse on HIGH so it draws the eye without strobing.
        const alpha = 200 + Math.round(40 * Math.sin(animTime * 2.2));
        return [255, 255, 255, alpha];
      },
      billboard: true,
      parameters: { depthCompare: "always" },
      updateTriggers: {
        getIcon: attributions
          .map((a) => `${a.fingerprint.tag}:${a.fingerprint.confidence.toFixed(2)}`)
          .join(","),
        getColor: animTime,
      },
    }),
  ];
};
