export const PRESET_VIEW = {
  longitude: 37.025,
  latitude: 48.465,
  zoom: 12.5,
  pitch: 60,
  bearing: -18,
  minZoom: 8,
  maxZoom: 19,
} as const;

export const PRESET_BBOX = {
  west: 36.85,
  south: 48.37,
  east: 37.20,
  north: 48.56,
} as const;

export const MISSION = {
  callsign: "TASK FORCE FOXTROT",
  ao: "UA-IEV-01",
  classification: "UNCLASSIFIED // FOR DEMO",
  defcon: 3,
} as const;

export const HEATMAP_MAX_ZOOM = 14;
