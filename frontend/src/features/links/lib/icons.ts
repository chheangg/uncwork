import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GiBattleship,
  GiBullseye,
  GiBrodieHelmet,
  GiJetFighter,
  GiSatelliteCommunication,
  GiSubmarine,
  GiTank,
} from "react-icons/gi";
import type { IconType } from "react-icons";
import type { CotEvent, Dimension, LinkStatus } from "@/types/cot";

export type IconDef = {
  url: string;
  width: number;
  height: number;
  anchorY: number;
  mask: false;
};

const SIZE = 64;
const ICON_FILL = "#e9d9a8";
const ICON_HALO = "#040404";

const DIMENSION_ICON: Record<Dimension, IconType> = {
  air: GiJetFighter,
  ground: GiTank,
  sea_surface: GiBattleship,
  sea_subsurface: GiSubmarine,
  space: GiSatelliteCommunication,
  sof: GiBrodieHelmet,
  other: GiBullseye,
};

const dimensionInner = (() => {
  const cache: Partial<Record<Dimension, string>> = {};
  return (dim: Dimension): string => {
    const hit = cache[dim];
    if (hit) return hit;
    const fullSvg = renderToStaticMarkup(
      createElement(DIMENSION_ICON[dim], { size: 64 }),
    );
    const inner = fullSvg
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");
    cache[dim] = inner;
    return inner;
  };
})();

const renderBadge = (status: LinkStatus): string => {
  if (status === "healthy") return "";
  const x = 42;
  const y = 0;
  const s = 22;
  const cx = x + s / 2;
  const cy = y + s / 2;

  if (status === "degraded" || status === "critical") {
    const fill = status === "critical" ? "#ff3a3a" : "#ffd166";
    return `<g><polygon points="${cx},${y + 1} ${x + s - 1},${y + s - 1} ${x + 1},${y + s - 1}" fill="${fill}" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/><text x="${cx}" y="${y + s - 4}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" font-weight="900" fill="#000">!</text></g>`;
  }
  if (status === "stale") {
    return `<g><circle cx="${cx}" cy="${cy}" r="${s / 2 - 1}" fill="#ff8c42" stroke="#000" stroke-width="1.5"/><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - 5}" stroke="#000" stroke-width="2" stroke-linecap="round"/><line x1="${cx}" y1="${cy}" x2="${cx + 5}" y2="${cy}" stroke="#000" stroke-width="2" stroke-linecap="round"/></g>`;
  }
  return `<g><circle cx="${cx}" cy="${cy}" r="${s / 2 - 1}" fill="#666" stroke="#000" stroke-width="1.5"/><line x1="${cx - 5}" y1="${cy - 5}" x2="${cx + 5}" y2="${cy + 5}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><line x1="${cx + 5}" y1="${cy - 5}" x2="${cx - 5}" y2="${cy + 5}" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g>`;
};

const buildSvg = (
  dimension: Dimension,
  status: LinkStatus,
  inline: boolean,
): string => {
  const inner = dimensionInner(dimension);
  const badge = renderBadge(status);
  const dims = inline
    ? `width="100%" height="100%"`
    : `width="${SIZE}" height="${SIZE}"`;
  const transform = `translate(5 5) scale(0.105)`;
  const halo = `<g stroke="${ICON_HALO}" stroke-width="32" stroke-linejoin="round" stroke-linecap="round" fill="${ICON_HALO}" opacity="0.92">${inner}</g>`;
  const body = `<g fill="${ICON_FILL}">${inner}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${dims} viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet"><g transform="${transform}" fill-rule="evenodd">${halo}${body}</g>${badge}</svg>`;
};

const URL_CACHE = new Map<string, IconDef>();

export const iconFor = (event: CotEvent): IconDef => {
  const key = `${event.dimension}:${event.status}`;
  const hit = URL_CACHE.get(key);
  if (hit) return hit;
  const svg = buildSvg(event.dimension, event.status, false);
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
): string => buildSvg(dimension, status, true);
