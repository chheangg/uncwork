export type Affiliation =
  | "friendly"
  | "hostile"
  | "neutral"
  | "unknown"
  | "pending"
  | "assumed"
  | "suspect";

export type Dimension =
  | "air"
  | "ground"
  | "sea_surface"
  | "sea_subsurface"
  | "space"
  | "sof"
  | "other";

export type LinkStatus =
  | "healthy"
  | "degraded"
  | "critical"
  | "stale"
  | "offline";

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
  affiliation: Affiliation;
  dimension: Dimension;
  sensorType: SensorType;
  time: string;
  start: string;
  stale: string;
  lat: number;
  lon: number;
  hae?: number;
  ce?: number;
  le?: number;
  remarks?: string;
  callsign?: string;
  confInt: number;
  status: LinkStatus;
};
