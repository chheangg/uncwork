export const PRESET_VIEW = {
  longitude: 30.5234,
  latitude: 50.4501,
  zoom: 15.4,
  pitch: 60,
  bearing: -18,
  minZoom: 11,
  maxZoom: 19,
} as const;

export const PRESET_BBOX = {
  west: 30.46,
  south: 50.405,
  east: 30.62,
  north: 50.495,
} as const;

export const STALE_THRESHOLDS_MS = {
  healthy: 15_000,
  degraded: 60_000,
  critical: 180_000,
} as const;

export const MISSION = {
  callsign: "TASK FORCE FOXTROT",
  ao: "UA-KYV-01",
  classification: "UNCLASSIFIED // FOR DEMO",
  defcon: 3,
} as const;
