import { IconLayer } from "@deck.gl/layers";
import type { Layer } from "@deck.gl/core";
import type { CotEvent, FingerprintMatch } from "@/types/cot";
import type { TrackPath } from "@/lib/track-path";
import { positionAt } from "@/lib/track-path";
import { fingerprintTone } from "./fingerprint-tone";

const ICON_W = 88;
const ICON_H = 32;

// A sender's own ground track has lat/lon equal to the sensor lat/lon
// it stamps onto every frame. Picking the badge anchor by that
// equality keeps us from rendering a duplicate badge over every UAV /
// aircraft that the same unit happens to be reporting on a jammed
// wire — the badge belongs over the *transmitter*, not the asset.
const POSITION_EPSILON = 1e-4;

const isSenderOwnTrack = (e: CotEvent): boolean =>
  e.sensorLat !== undefined &&
  e.sensorLon !== undefined &&
  Math.abs(e.lat - e.sensorLat) < POSITION_EPSILON &&
  Math.abs(e.lon - e.sensorLon) < POSITION_EPSILON;

const buildBadgeIcon = (fp: FingerprintMatch) => {
  const tone = fingerprintTone(fp.confidence);
  const pct = Math.round(fp.confidence * 100);
  const tagText = fp.tag.toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_W} ${ICON_H}" width="${ICON_W}" height="${ICON_H}">
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
  return {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    width: ICON_W,
    height: ICON_H,
    anchorX: ICON_W,
    anchorY: ICON_H / 2,
  };
};

type BadgeDatum = {
  uid: string;
  fingerprint: FingerprintMatch;
  position: [number, number, number];
};

// Per-link FR-04 fingerprint badge — small status box pinned to the
// *left* of the transmitting unit's icon. Position comes from
// `positionAt(track.path, track.timestamps, renderTime)` so the badge
// rides the same interpolation as the icon and pole, instead of
// snapping to a stored `(sensorLat, sensorLon)` snapshot.
//
// Confidence drives a three-step red gradient (LOW / MED / HIGH);
// HIGH-confidence matches breathe via a slow alpha pulse keyed off
// `animTime`.
export const buildAttributionLayer = <T extends CotEvent>(
  paths: TrackPath<T>[],
  renderTime: number,
  animTime: number,
): Layer[] => {
  const data: BadgeDatum[] = [];
  for (const p of paths) {
    const fp = p.latest.detectors?.fingerprint;
    if (!fp) continue;
    if (!isSenderOwnTrack(p.latest)) continue;
    const [lon, lat] = positionAt(p.path, p.timestamps, renderTime);
    data.push({
      uid: p.uid,
      fingerprint: fp,
      position: [lon, lat, 30],
    });
  }
  if (data.length === 0) return [];

  const iconKey = data
    .map((d) => `${d.uid}:${d.fingerprint.tag}:${d.fingerprint.confidence.toFixed(2)}`)
    .join("|");

  return [
    new IconLayer<BadgeDatum>({
      id: "attribution-badge",
      data,
      pickable: false,
      sizeUnits: "pixels",
      getPosition: (d) => d.position,
      getIcon: (d) => buildBadgeIcon(d.fingerprint),
      getSize: ICON_H,
      sizeMinPixels: ICON_H,
      sizeMaxPixels: ICON_H * 1.3,
      // Slot the badge to the left of the ground icon so the
      // top-right (status) and bottom-right (stale) badges baked into
      // the milsymbol SVG stay clear.
      getPixelOffset: [-46, 0],
      getColor: (d) => {
        const tone = fingerprintTone(d.fingerprint.confidence);
        if (!tone.pulse) return [255, 255, 255, 240];
        const alpha = 200 + Math.round(40 * Math.sin(animTime * 2.2));
        return [255, 255, 255, alpha];
      },
      billboard: true,
      parameters: { depthCompare: "always" },
      updateTriggers: {
        getPosition: renderTime,
        getIcon: iconKey,
        getColor: animTime,
      },
    }),
  ];
};
