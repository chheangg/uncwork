export type Dimension =
  | "air"
  | "ground"
  | "sea_surface"
  | "sea_subsurface"
  | "space"
  | "sof"
  | "sensor"
  | "other";

export type LinkStatus = "healthy" | "degraded" | "critical" | "offline";

export type SensorType =
  | "radar"
  | "sonar"
  | "eo_ir"
  | "sigint"
  | "acoustic"
  | "seismic"
  | "ais"
  | "lidar"
  | "ew"
  | "adsb";

export type CotEvent = {
  uid: string;
  cotType: string;
  dimension: Dimension;
  sensorType: SensorType;
  time: string;
  start: string;
  staleAt: string;
  lat: number;
  lon: number;
  hae?: number;
  ce?: number;
  le?: number;
  remarks?: string;
  callsign?: string;
  trustScore: number;
  status: LinkStatus;
  stale: boolean;
};
