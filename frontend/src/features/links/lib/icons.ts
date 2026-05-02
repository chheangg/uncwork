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
import type { CotEvent, Dimension } from "@/types/cot";

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

const buildSvg = (dimension: Dimension, inline: boolean): string => {
  const inner = dimensionInner(dimension);
  const dims = inline
    ? `width="100%" height="100%"`
    : `width="${SIZE}" height="${SIZE}"`;
  const transform = `translate(5 5) scale(0.105)`;
  const halo = `<g stroke="${ICON_HALO}" stroke-width="32" stroke-linejoin="round" stroke-linecap="round" fill="${ICON_HALO}" opacity="0.92">${inner}</g>`;
  const body = `<g fill="${ICON_FILL}">${inner}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${dims} viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet"><g transform="${transform}" fill-rule="evenodd">${halo}${body}</g></svg>`;
};

const URL_CACHE = new Map<Dimension, IconDef>();

export const iconFor = (event: CotEvent): IconDef => {
  const hit = URL_CACHE.get(event.dimension);
  if (hit) return hit;
  const svg = buildSvg(event.dimension, false);
  const def: IconDef = {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    width: SIZE,
    height: SIZE,
    anchorY: SIZE,
    mask: false,
  };
  URL_CACHE.set(event.dimension, def);
  return def;
};

export const previewSvg = (dimension: Dimension): string =>
  buildSvg(dimension, true);
