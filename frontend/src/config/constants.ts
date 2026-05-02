export const PRESET_VIEW = {
  longitude: 30.5234,
  latitude: 50.4501,
  zoom: 12.2,
  pitch: 60,
  bearing: -18,
  minZoom: 8,
  maxZoom: 19,
} as const;

export const PRESET_BBOX = {
  west: 30.35,
  south: 50.34,
  east: 30.7,
  north: 50.56,
} as const;

export const MISSION = {
  callsign: "TASK FORCE FOXTROT",
  ao: "UA-IEV-01",
  classification: "UNCLASSIFIED // FOR DEMO",
  defcon: 3,
} as const;

export const HEATMAP_MAX_ZOOM = 14;
