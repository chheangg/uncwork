const FALLBACK_STYLE = "mapbox://styles/mapbox/dark-v11";

export const env = {
  mapStyleUrl: import.meta.env.VITE_MAP_STYLE_URL ?? FALLBACK_STYLE,
  mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN ?? "",
};
