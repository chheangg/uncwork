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

/**
 * **FR-03** spatial-classifier output. Mirrors the listener's
 * `SpatialClass` enum (snake_case via serde rename_all).
 */
export type SpatialClass = "clear" | "localized" | "blanket";

/**
 * **FR-04** signature classifier output. The listener selects the
 * top-scoring catalog entry whose signature fits this sender's observed
 * wire shape (drop / dup / reorder / CRC / spatial / temporal). `null`
 * for clean traffic and for degraded traffic that doesn't resemble any
 * catalog entry above the confidence floor.
 *
 * Numeric fields here are JSON numbers, not the strings-as-numbers
 * convention used for lat/lon/hae/ce/le on the wire. The listener emits
 * them via serde's default `f64`/`u64` serialization.
 */
export type FingerprintMatch = {
  tag: string;
  name: string;
  /** Mean per-axis fit, 0..1. Frontend reds keyed off this scalar. */
  confidence: number;
  /** Names of signature axes that contributed positively (fit > 0.5). */
  matchedSignals: string[];
  freqBandMhz: [number, number];
  gnssOverlap: string;
  rangeKm: number;
  sectorDeg: number | null;
  source: string;
  primaryEffect: string;
};

/**
 * Per-frame detector bag emitted by the listener alongside the trust
 * score. Each axis is independent — chips render only the active ones.
 */
export type Detectors = {
  temporalAnomaly: boolean;
  crcPct60s: number;
  crcBreach: boolean;
  spatialClass: SpatialClass;
  fingerprint: FingerprintMatch | null;
};

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
  /**
   * **FR-04 routing key.** Parsed from the `unit=<id>` token in the CoT
   * `<remarks>` body — identifies which ground sender transmitted this
   * frame. Used by the attribution rollup so a fingerprint match on a
   * track is credited back to the ground asset whose wire it rode in on.
   * `undefined` for mock feed and OpenSky frames without the token.
   */
  senderUnit?: string;
  /**
   * Ground asset's own position at the time it transmitted this frame —
   * the listener mirrors the unit's lat/lon into every frame it sends.
   * Used to anchor the attribution badge over the ground unit, not over
   * the tracked aircraft. `undefined` for mock and any frame whose
   * sender hasn't reported a sensor position yet.
   */
  sensorLat?: number;
  sensorLon?: number;
  /**
   * **FR-01..04** detector outputs. `undefined` for the mock feed.
   */
  detectors?: Detectors;
};
