export const PRESET_VIEW = {
  longitude: 37.176,
  latitude: 48.281,
  zoom: 14.5,
  pitch: 60,
  bearing: -18,
  minZoom: 9,
  maxZoom: 19,
} as const;

export const PRESET_BBOX = {
  west: 37.10,
  south: 48.235,
  east: 37.255,
  north: 48.33,
} as const;

export const STALE_THRESHOLDS_MS = {
  healthy: 15_000,
  degraded: 60_000,
  critical: 180_000,
} as const;

export const MISSION = {
  callsign: "TASK FORCE FOXTROT",
  ao: "UA-PKV-01",
  classification: "UNCLASSIFIED // FOR DEMO",
  defcon: 3,
} as const;

export const HEATMAP_MAX_ZOOM = 13;
