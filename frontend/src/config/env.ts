const FALLBACK_STYLE = "https://tiles.openfreemap.org/styles/dark";

export const env = {
  mapStyleUrl: import.meta.env.VITE_MAP_STYLE_URL ?? FALLBACK_STYLE,
};
