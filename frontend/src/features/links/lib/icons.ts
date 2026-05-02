import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Anchor,
  CircleDot,
  Crosshair,
  Plane,
  Satellite,
  Ship,
  Truck,
  type LucideProps,
} from "lucide-react";
import type { Affiliation, CotEvent, Dimension } from "@/types/cot";

export type IconDef = {
  url: string;
  width: number;
  height: number;
  anchorY: number;
  mask: false;
};

const SIZE = 64;

const AFFILIATION_COLOR: Record<Affiliation, string> = {
  friendly: "#58a6ff",
  hostile: "#ff3a3a",
  neutral: "#4ade80",
  unknown: "#ffd166",
  pending: "#ff8c42",
  assumed: "#a371f7",
  suspect: "#d674a8",
};

const DASHED: Record<Affiliation, boolean> = {
  friendly: false,
  hostile: false,
  neutral: false,
  unknown: false,
  pending: true,
  assumed: true,
  suspect: true,
};

const DIMENSION_ICON: Record<Dimension, ComponentType<LucideProps>> = {
  air: Plane,
  ground: Truck,
  sea_surface: Ship,
  sea_subsurface: Anchor,
  space: Satellite,
  sof: Crosshair,
  other: CircleDot,
};

const dimensionInner = (() => {
  const cache: Partial<Record<Dimension, string>> = {};
  return (dim: Dimension): string => {
    const hit = cache[dim];
    if (hit) return hit;
    const fullSvg = renderToStaticMarkup(
      createElement(DIMENSION_ICON[dim], {
        size: 24,
        color: "currentColor",
        strokeWidth: 2.2,
      }),
    );
    const inner = fullSvg
      .replace(/^<svg[^>]*>/, "")
      .replace(/<\/svg>$/, "");
    cache[dim] = inner;
    return inner;
  };
})();

const buildSvg = (
  dimension: Dimension,
  affiliation: Affiliation,
  inline: boolean,
): string => {
  const color = AFFILIATION_COLOR[affiliation];
  const inner = dimensionInner(dimension);
  const dashAttr = DASHED[affiliation] ? ' stroke-dasharray="4 3"' : "";
  const dims = inline
    ? `width="100%" height="100%"`
    : `width="${SIZE}" height="${SIZE}"`;
  const baseGroup = `<g transform="translate(3.2 3.2) scale(2.4)" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
  const shadow = `<g color="#000" stroke="#000" stroke-width="5" opacity="0.7">${inner}</g>`;
  const stroke = `<g color="${color}" stroke="${color}" stroke-width="2.6"${dashAttr}>${inner}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${dims} viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet">${baseGroup}${shadow}${stroke}</g></svg>`;
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
