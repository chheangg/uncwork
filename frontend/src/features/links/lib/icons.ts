import ms from "milsymbol";
import type { CotEvent, Dimension, LinkStatus } from "@/types/cot";

export type IconDef = {
  url: string;
  width: number;
  height: number;
  anchorY: number;
  mask: false;
};

const SIZE = 64;
const BADGE_SIZE = 28;
const SYMBOL_INSET = 3;

// MIL-STD-2525C SIDC per dimension. Position 2 is hard-coded to F
// (Friend) -- this is a friendly-only C2 console.
//
// Position 3 is the battle dimension code; positions 5-10 are the
// function ID. milsymbol pads short SIDCs to 15 chars internally.
const SIDC_BY_DIMENSION: Record<Dimension, string> = {
  air: "SFAPMF----",      // Air, military fixed wing
  ground: "SFGPU-----",   // Ground unit, generic
  sea_surface: "SFSPC-----",   // Sea surface combatant
  sea_subsurface: "SFUPS-----", // Sub-surface, submarine
  space: "SFPPS-----",    // Space track
  sof: "SFFPU-----",      // Special operations unit
  sensor: "SFGPESR---",   // Ground equipment, sensor, radar
  other: "SFGPU-----",    // Fallback to generic ground unit
};

type SymbolGeom = { inner: string; viewBox: string };

const SYMBOL_CACHE = new Map<string, SymbolGeom>();

const buildSymbolGeom = (sidc: string): SymbolGeom => {
  const hit = SYMBOL_CACHE.get(sidc);
  if (hit) return hit;
  const sym = new ms.Symbol(sidc, {
    size: 60,
    outlineWidth: 4,
    outlineColor: "#0a0a0a",
  });
  const svg = sym.asSVG();
  const vbMatch = svg.match(/viewBox="([^"]+)"/);
  const viewBox = vbMatch ? vbMatch[1]! : "0 0 100 100";
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const geom = { inner, viewBox };
  SYMBOL_CACHE.set(sidc, geom);
  return geom;
};

const renderStatusBadge = (status: LinkStatus, recovery: boolean): string => {
  if (status === "healthy" && !recovery) return "";

  const x = 36;
  const y = 0;
  const s = BADGE_SIZE;
  const cx = x + s / 2;
  const cy = y + s / 2;

  if (recovery) {
    return `<g><circle cx="${cx}" cy="${cy}" r="${s / 2 - 1.5}" fill="#4ade80" stroke="#0a0a0a" stroke-width="2"/><path d="M ${cx - 6} ${cy + 1} L ${cx - 1} ${cy + 6} L ${cx + 7} ${cy - 5}" stroke="#0a0a0a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }

  if (status === "degraded" || status === "critical") {
    const fill = status === "critical" ? "#ff3a3a" : "#ffd166";
    return `<g><polygon points="${cx},${y + 1} ${x + s - 1},${y + s - 1} ${x + 1},${y + s - 1}" fill="${fill}" stroke="#0a0a0a" stroke-width="2" stroke-linejoin="round"/><text x="${cx}" y="${y + s - 5}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="16" font-weight="900" fill="#0a0a0a">!</text></g>`;
  }

  return `<g><circle cx="${cx}" cy="${cy}" r="${s / 2 - 1.5}" fill="#888" stroke="#0a0a0a" stroke-width="2"/><line x1="${cx - 6}" y1="${cy - 6}" x2="${cx + 6}" y2="${cy + 6}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><line x1="${cx + 6}" y1="${cy - 6}" x2="${cx - 6}" y2="${cy + 6}" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>`;
};

const renderStaleBadge = (stale: boolean): string => {
  if (!stale) return "";
  const x = 36;
  const y = SIZE - BADGE_SIZE;
  const s = BADGE_SIZE;
  const cx = x + s / 2;
  const cy = y + s / 2;
  return `<g><circle cx="${cx}" cy="${cy}" r="${s / 2 - 1.5}" fill="#ff8c42" stroke="#0a0a0a" stroke-width="2"/><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 7}" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${cx + 7}" y2="${cy}" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round"/></g>`;
};

const buildSvg = (
  dimension: Dimension,
  status: LinkStatus,
  recovery: boolean,
  stale: boolean,
  inline: boolean,
): string => {
  const sidc = SIDC_BY_DIMENSION[dimension];
  const { inner, viewBox } = buildSymbolGeom(sidc);
  const statusBadge = renderStatusBadge(status, recovery);
  const staleBadge = renderStaleBadge(stale);
  const dims = inline
    ? `width="100%" height="100%"`
    : `width="${SIZE}" height="${SIZE}"`;
  // Nested SVG scales the milsymbol output (which has its own
  // arbitrary viewBox per SIDC) into a square cell, leaving the
  // outer-canvas corners free for our status / stale badges.
  const symbolBlock =
    `<svg x="${SYMBOL_INSET}" y="${SYMBOL_INSET}" ` +
    `width="${SIZE - SYMBOL_INSET * 2}" height="${SIZE - SYMBOL_INSET * 2}" ` +
    `viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ${dims} ` +
    `viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet">` +
    `${symbolBlock}${statusBadge}${staleBadge}</svg>`
  );
};

const URL_CACHE = new Map<string, IconDef>();

export const iconFor = (
  event: CotEvent & { recentlyAffected?: boolean },
): IconDef => {
  const recovery = !!event.recentlyAffected;
  const stale = !!event.stale;
  const key = `${event.dimension}:${event.status}:${recovery ? "rec" : "norm"}:${stale ? "late" : "ontime"}`;
  const hit = URL_CACHE.get(key);
  if (hit) return hit;
  const svg = buildSvg(event.dimension, event.status, recovery, stale, false);
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
  status: LinkStatus = "healthy",
  recovery: boolean = false,
  stale: boolean = false,
): string => buildSvg(dimension, status, recovery, stale, true);
