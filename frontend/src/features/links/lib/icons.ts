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

const buildSvg = (
  dimension: Dimension,
  affiliation: Affiliation,
  inline: boolean,
): string => {
  const color = AFFILIATION_COLOR[affiliation];
  const inner = dimensionInner(dimension);
  const dims = inline
    ? `width="100%" height="100%"`
    : `width="${SIZE}" height="${SIZE}"`;
  const transform = `translate(4 4) scale(0.109)`;
  const halo = `<g stroke="#000" stroke-width="44" stroke-linejoin="round" stroke-linecap="round" fill="#000" opacity="0.85">${inner}</g>`;
  const body = `<g fill="${color}">${inner}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" ${dims} viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid meet"><g transform="${transform}" fill-rule="evenodd">${halo}${body}</g></svg>`;
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
