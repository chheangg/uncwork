export const PRESET_VIEW = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 11.5,
  pitch: 55,
  bearing: -18,
  minZoom: 6,
  maxZoom: 19,
} as const;

export const PRESET_BBOX = {
  west: -123.5,
  south: 36.5,
  east: -121.0,
  north: 38.5,
} as const;

export const STALE_THRESHOLDS_MS = {
  healthy: 15_000,
  degraded: 60_000,
  critical: 180_000,
} as const;

export const MISSION = {
  callsign: "TASK FORCE FOXTROT",
  ao: "US-SFO-01",
  classification: "UNCLASSIFIED // FOR DEMO",
  defcon: 3,
} as const;

export const HEATMAP_MAX_ZOOM = 11;
