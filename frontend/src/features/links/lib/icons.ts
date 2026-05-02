import type { Affiliation, CotEvent, Dimension } from "@/types/cot";

export type IconDef = {
  url: string;
  width: number;
  height: number;
  anchorY: number;
  mask: false;
};

const SIZE = 64;

const FRAME_FILL: Record<Affiliation, string> = {
  friendly: "#1f6feb",
  hostile: "#ff1414",
  neutral: "#2ea043",
  unknown: "#e3b341",
  pending: "#e08c3a",
  assumed: "#a371f7",
  suspect: "#d674a8",
};

const GLYPH: Record<Dimension, string> = {
  air: "▲",
  ground: "■",
  sea_surface: "◆",
  sea_subsurface: "▽",
  space: "✦",
  sof: "✚",
  other: "●",
};

const buildFrame = (affiliation: Affiliation, fill: string, stroke: string): string => {
  const dashed = (base: string) =>
    base.replace('stroke-width="3"', 'stroke-width="3" stroke-dasharray="5 3"');

  const rectangle = `<rect x="6" y="14" width="52" height="36" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  const diamond = `<polygon points="32,4 60,32 32,60 4,32" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  const square = `<rect x="8" y="8" width="48" height="48" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  const quatrefoil = `<path d="M22,6 Q32,0 42,6 Q58,8 58,22 Q64,32 58,42 Q58,56 42,58 Q32,64 22,58 Q6,56 6,42 Q0,32 6,22 Q6,8 22,6 Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;
  const hexagon = `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`;

  switch (affiliation) {
    case "friendly":
      return rectangle;
    case "hostile":
      return diamond;
    case "neutral":
      return square;
    case "unknown":
      return quatrefoil;
    case "pending":
      return dashed(rectangle);
    case "assumed":
      return dashed(diamond);
    case "suspect":
      return dashed(hexagon);
  }
};

const buildSvg = (
  dimension: Dimension,
  affiliation: Affiliation,
  inline: boolean,
): string => {
  const fill = FRAME_FILL[affiliation];
  const stroke = "#0b0202";
  const frame = buildFrame(affiliation, fill, stroke);
  const glyph = GLYPH[dimension];
  const dims = inline
    ? `width="100%" height="100%"`
    : `width="${SIZE}" height="${SIZE}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${dims} viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet"><g>${frame}<text x="32" y="42" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="26" fill="#ffffff">${glyph}</text></g></svg>`;
};

const URL_CACHE = new Map<string, IconDef>();

export const iconFor = (event: CotEvent): IconDef => {
  const key = `${event.dimension}:${event.affiliation}`;
  const hit = URL_CACHE.get(key);
  if (hit) return hit;
  const svg = buildSvg(event.dimension, event.affiliation, false);
  const def: IconDef = {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    width: SIZE,
    height: SIZE,
    anchorY: SIZE,
    mask: false,
  };
  URL_CACHE.set(key, def);
  return def;
};

export const previewSvg = (
  dimension: Dimension,
  affiliation: Affiliation,
): string => buildSvg(dimension, affiliation, true);
