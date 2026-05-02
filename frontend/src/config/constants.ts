export const PRESET_VIEW = {
  longitude: -122.4194,
  latitude: 37.7749,
  zoom: 14.5,
  pitch: 55,
  bearing: -22,
  minZoom: 11,
  maxZoom: 19,
} as const;

export const PRESET_BBOX = {
  west: -122.46,
  south: 37.74,
  east: -122.38,
  north: 37.81,
} as const;

export const STALE_THRESHOLDS_MS = {
  healthy: 15_000,
  degraded: 60_000,
  critical: 180_000,
} as const;
