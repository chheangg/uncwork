const FALLBACK_STYLE = "mapbox://styles/mapbox/dark-v11";
const FALLBACK_API_HOST = "localhost:3000";

export const env = {
  mapStyleUrl: import.meta.env.VITE_MAP_STYLE_URL ?? FALLBACK_STYLE,
  mapboxToken: import.meta.env.VITE_MAPBOX_TOKEN ?? "",
  apiHost: import.meta.env.VITE_API_HOST ?? FALLBACK_API_HOST,
};

export const wsUrl = (path: string): string => {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${env.apiHost}${path}`;
};

export const httpUrl = (path: string): string => {
  const proto = window.location.protocol === "https:" ? "https:" : "http:";
  return `${proto}//${env.apiHost}${path}`;
};
